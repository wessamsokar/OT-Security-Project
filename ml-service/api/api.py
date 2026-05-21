"""
api.py  ──  FastAPI service for ICS/OT NDR Engine  v2.1
═══════════════════════════════════════════════════════════════
AI-based Network Detection & Response for Smart Grid / ICS

Endpoints:
  POST /predict          → analyse a single network flow
  POST /predict/batch    → analyse a list of flows  (max 1000)
  GET  /test             → run a built-in sample and return result
  GET  /health           → liveness + model readiness probe
  GET  /session/stats    → current session statistics
  POST /session/reset    → reset session state

Run locally:
  uvicorn api.api:app --host 0.0.0.0 --port 8000 --reload

Docker:
  CMD ["uvicorn", "api.api:app", "--host", "0.0.0.0", "--port", "8000"]

Swagger UI:
  http://localhost:8000/docs
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from engine.ndr_engine import NDREngine


# ═══════════════════════════════════════════════════════════════
# LOGGING SETUP
# ═══════════════════════════════════════════════════════════════

# Ensure logs directory always exists before engine starts
Path("logs").mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("NDR-API")


# ═══════════════════════════════════════════════════════════════
# APP SETUP
# ═══════════════════════════════════════════════════════════════

_app_env = os.environ.get("APP_ENV", "development").strip().lower()
_is_production = _app_env in {"production", "prod", "staging"}

app = FastAPI(
    title="ICS/OT NDR Engine API",
    description=(
        "AI-based Network Detection & Response for Smart Grid / ICS environments.\n\n"
        "Hybrid detection: XGBoost (known attacks) + Autoencoder (zero-day anomalies).\n\n"
        "Use **GET /test** to verify the system is working end-to-end before integration."
    ),
    version="2.1.0",
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
)

# ── CORS — allow all origins during development ──────────────
# Restrict allow_origins in production to your frontend domain.
_ml_internal_key = os.environ.get("ML_INTERNAL_API_KEY", "").strip()
_ml_allowed_origins = [
    o.strip()
    for o in os.environ.get("ML_CORS_ORIGINS", "").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ml_allowed_origins or [],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-ML-Internal-Key"],
)


@app.middleware("http")
async def internal_service_auth(request: Request, call_next):
    """Restrict inference to backend callers when ML_INTERNAL_API_KEY is set."""
    path = request.url.path.rstrip("/") or "/"
    public_paths = {"/health", "/healthz", "/readyz"}
    if path in public_paths:
        return await call_next(request)
    if _ml_internal_key:
        provided = request.headers.get("x-ml-internal-key", "")
        if provided != _ml_internal_key:
            return JSONResponse(status_code=403, content={"detail": "Internal ML API key required"})
    return await call_next(request)

# ── Global state ─────────────────────────────────────────────
_engine: Optional[NDREngine] = None
_startup_time: float = 0.0
_engine_ready: bool = False


# ═══════════════════════════════════════════════════════════════
# STARTUP / SHUTDOWN
# ═══════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup_event() -> None:
    global _engine, _startup_time, _engine_ready
    _startup_time = time.time()
    logger.info("Loading NDR Engine …")
    try:
        _engine = NDREngine(enable_logging=True, enable_response=True)
        _engine_ready = True
        logger.info("NDR Engine loaded successfully.")
    except Exception as exc:
        _engine_ready = False
        logger.error("Engine failed to load: %s", exc)
        # Do NOT re-raise — let /health surface the failure gracefully


@app.on_event("shutdown")
async def shutdown_event() -> None:
    logger.info("NDR API shutting down.")


# ── Helper ───────────────────────────────────────────────────

def get_engine() -> NDREngine:
    """Return the global engine or raise 503 if not ready."""
    if _engine is None or not _engine_ready:
        raise HTTPException(
            status_code=503,
            detail="NDR Engine is not ready. Check /health for details.",
        )
    return _engine


# ═══════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════

class NetworkFlow(BaseModel):
    """
    A single network flow record.  Only the fields listed below
    are required; any extra fields in the payload are forwarded
    to the feature-engineering pipeline unchanged.
    """
    duration:    float          = Field(0.0,   description="Flow duration (seconds)")
    sPackets:    int            = Field(0,     description="Sender packet count")
    rPackets:    int            = Field(0,     description="Receiver packet count")
    sBytesSum:   float          = Field(0.0,   description="Total bytes sent")
    rBytesSum:   float          = Field(0.0,   description="Total bytes received")
    sLoad:       float          = Field(0.0,   description="Sender throughput (bps)")
    rLoad:       float          = Field(0.0,   description="Receiver throughput (bps)")
    sSynRate:    float          = Field(0.0,   description="SYN flag rate (sender)")
    sAckRate:    float          = Field(0.0,   description="ACK flag rate (sender)")
    sFinRate:    float          = Field(0.0,   description="FIN flag rate (sender)")
    sRstRate:    float          = Field(0.0,   description="RST flag rate (sender)")
    sPayloadAvg: float          = Field(0.0,   description="Avg payload size — sender (bytes)")
    rPayloadAvg: float          = Field(0.0,   description="Avg payload size — receiver (bytes)")
    protocol:    str            = Field("tcp", description="Protocol: tcp / udp / icmp / arp / igmp / other")
    sAddress:    Optional[str]  = Field(None,  description="Source IP address (used for tracking & logging)")

    class Config:
        extra = "allow"   # extra dataset columns pass through to feature engineering


class DetectionResult(BaseModel):
    """Standardised detection response — every field always present."""
    timestamp:    str
    src:          str
    attack:       str
    group:        str
    severity:     str
    risk_score:   float
    confidence:   float
    recon_error:  float
    is_anomaly:   bool
    detected_by:  str
    action:       str
    is_blocked:   bool
    actions_taken: List[str]


class BatchRequest(BaseModel):
    flows: List[NetworkFlow] = Field(..., min_items=1, max_items=1000)


class BatchResponse(BaseModel):
    total:   int
    results: List[Dict[str, Any]]
    summary: Dict[str, Any]


class InferRequest(BaseModel):
    """
    Backward-compatible contract from the platform backend. Converted to the
    same NetworkFlow field names as POST /predict (duration, sPackets, protocol, …).
    """

    packet_count: int = Field(ge=1)
    bytes_in: int = Field(ge=0)
    bytes_out: int = Field(ge=0)
    duration_ms: float = Field(ge=0)
    payload_entropy: float = Field(ge=0, le=8)
    source_port: int = Field(ge=1, le=65535)
    destination_port: int = Field(ge=1, le=65535)
    modbus_function_code: int = Field(default=0, ge=0, le=255)
    modbus_unit_id: int = Field(default=0, ge=0, le=255)
    dnp3_function_code: int = Field(default=0, ge=0, le=255)
    iec104_type_id: int = Field(default=0, ge=0, le=255)
    transport_protocol: str
    source_ip: str | None = Field(default=None, max_length=256)
    destination_ip: str | None = Field(default=None, max_length=256)

    @field_validator("modbus_function_code", "modbus_unit_id", "dnp3_function_code", "iec104_type_id", mode="before")
    @classmethod
    def ics_null_as_zero(cls, v: object) -> int:
        if v is None or v == "":
            return 0
        return int(v)  # type: ignore[arg-type]

    @field_validator("transport_protocol", mode="before")
    @classmethod
    def normalize_protocol(cls, v: object) -> str:
        if not isinstance(v, str):
            raise ValueError("transport_protocol must be a string")
        s = v.lower().strip()
        if s not in ("tcp", "udp", "icmp"):
            raise ValueError("transport_protocol must be one of: tcp, udp, icmp")
        return s


class RetrainRequest(BaseModel):
    triggered_by: str = "system"
    retrain_job_id: str | None = None


def _convert_infer_to_flow(payload: InferRequest) -> Dict[str, Any]:
    """
    Map the platform JSON contract to the same row shape as POST /predict
    (NetworkFlow: duration, sPackets, sBytesSum, protocol, sAddress, …) plus
    ICS / entropy / ports so feature engineering matches training & /predict.
    """
    duration_seconds = max(payload.duration_ms / 1000.0, 0.001)
    total_bytes = payload.bytes_in + payload.bytes_out
    pc = max(int(payload.packet_count), 1)
    proto = payload.transport_protocol

    src = (payload.source_ip or "").strip()
    dst = (payload.destination_ip or "").strip()

    flow: Dict[str, Any] = {
        "duration": round(duration_seconds, 6),
        "sPackets": pc,
        "rPackets": max(1, int(pc * 0.1)),
        "sBytesSum": float(payload.bytes_out),
        "rBytesSum": float(payload.bytes_in),
        "sLoad": float(payload.bytes_out * 8.0 / duration_seconds),
        "rLoad": float(payload.bytes_in * 8.0 / duration_seconds),
        "sSynRate": 0.0,
        "sAckRate": 1.0 if proto == "tcp" else 0.2,
        "sFinRate": 0.0,
        "sRstRate": 0.0,
        "sPayloadAvg": float(total_bytes / pc),
        "rPayloadAvg": float(payload.bytes_in / pc),
        "protocol": proto,
        "sAddress": src if src else "0.0.0.0",
        "payload_entropy": float(payload.payload_entropy),
        "source_port": int(payload.source_port),
        "destination_port": int(payload.destination_port),
        "modbus_function_code": int(payload.modbus_function_code),
        "modbus_unit_id": int(payload.modbus_unit_id),
        "dnp3_function_code": int(payload.dnp3_function_code),
        "iec104_type_id": int(payload.iec104_type_id),
    }
    if dst:
        flow["rAddress"] = dst
    return flow


def _engine_label(result: Dict[str, Any]) -> str:
    if "attack" in result and result["attack"] is not None:
        return str(result["attack"])
    if "label" in result and result["label"] is not None:
        return str(result["label"])
    return ""


def _engine_severity_to_alert_severity(result: Dict[str, Any]) -> str:
    """Single mapping: engine tier → platform alert_severity (lowercase)."""
    sev = str(result.get("severity", "LOW")).upper()
    if sev == "CRITICAL":
        return "critical"
    if sev == "HIGH":
        return "high"
    if sev == "MEDIUM":
        return "medium"
    return "low"


def _attack_class_from_engine_label(raw_attack_upper: str) -> str:
    """Taxonomy for platform storage — defined only in ML service (Option A)."""
    attack_map = {
        "BENIGN": "normal",
        "NORMAL": "normal",
        "UNKNOWN": "scan",
        "SUSPICIOUS": "scan",
        "ACKFLOOD": "dos",
        "TCPFLOOD": "dos",
        "ICMPFLOOD": "dos",
        "PINGOFDEATH": "dos",
        "SMURF": "dos",
        "PORTSCAN": "scan",
        "NMAP": "scan",
        "WINNUKE": "command_injection",
        "ERROR": "unknown_degraded",
    }
    return attack_map.get(raw_attack_upper, "scan")


def _derive_ml_status_from_engine(result: Dict[str, Any]) -> str:
    """
    Map engine output → platform ml_status.
    Never returns 'normal' for ERROR — caller must short-circuit to unknown_degraded first.
    """
    sev = str(result.get("severity", "LOW")).upper()
    raw = str(_engine_label(result) or "UNKNOWN").upper()
    benign = raw in ("BENIGN", "NORMAL")
    is_anomaly = bool(result.get("is_anomaly", False))

    if sev == "CRITICAL" or (not benign and sev == "HIGH"):
        return "under_attack"
    if sev == "MEDIUM" or (sev == "HIGH" and benign):
        return "suspicious"
    return "normal"


def _canonical_degraded_infer_response(result: Dict[str, Any], reason: str) -> Dict[str, Any]:
    """
    Explicit failure contract — NOT coerced to benign normal.
    Backend stores this verbatim.
    """
    explanation = {
        "method": "smartgrid_infer",
        "evaluation_failed": True,
        "failure_reason": reason,
        "engine_attack": result.get("attack") or result.get("label"),
        "engine_severity": result.get("severity"),
        "detected_by": result.get("detected_by", "unknown"),
        "group": result.get("group", "UNKNOWN"),
    }
    return {
        "risk_score": None,
        "ml_status": "unknown_degraded",
        "alert_severity": "high",
        "attack_detected": True,
        "attack_class": "unknown_degraded",
        "confidence": 0.0,
        "model_version": "smartgrid-v2.1",
        "explanation": explanation,
    }


def _merge_infer_engine_row(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Bridge engine keys — does NOT inject fake benign risk/confidence defaults."""
    out = {k: v for k, v in raw.items() if v is not None}
    if "attack" not in out and "label" in raw and raw["label"] is not None:
        out["attack"] = raw["label"]
    if not out.get("timestamp"):
        out["timestamp"] = datetime.utcnow().isoformat()
    return out


def canonical_infer_contract(result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mandatory platform contract for POST /infer.
    All verdict fields are finalized here — backend persists without reinterpretation.

    Canonical keys:
      risk_score (float 0–1 or null),
      ml_status,
      alert_severity,
      attack_detected,
      attack_class,
      confidence,
      model_version,
      explanation
    """
    label_raw = (_engine_label(result) or "").strip()
    raw_attack = label_raw.upper() if label_raw else "UNKNOWN"

    if raw_attack == "ERROR" or str(result.get("group", "")).upper() == "ERROR":
        return _canonical_degraded_infer_response(result, "engine_emitted_error_label")

    if not label_raw:
        return _canonical_degraded_infer_response(result, "missing_attack_label_after_inference")

    # numeric fields — require presence for trustworthy scores (else degraded)
    try:
        risk_raw = result.get("risk_score")
        conf_raw = result.get("confidence")
        if risk_raw is None or conf_raw is None:
            return _canonical_degraded_infer_response(result, "missing_risk_score_or_confidence")

        confidence = float(conf_raw)
        if confidence > 1.0:
            confidence = confidence / 100.0
        confidence = min(max(confidence, 0.0), 1.0)

        risk_score = float(risk_raw)
        if risk_score > 1.0:
            risk_score = risk_score / 100.0
        risk_score = min(max(risk_score, 0.0), 1.0)
    except (TypeError, ValueError):
        return _canonical_degraded_infer_response(result, "non_numeric_risk_or_confidence")

    ml_status = _derive_ml_status_from_engine(result)
    alert_severity = _engine_severity_to_alert_severity(result)

    raw_attack_upper = raw_attack
    attack_class = _attack_class_from_engine_label(raw_attack_upper)

    attack_detected = not (label_raw.upper() in ("BENIGN", "NORMAL"))

    explanation = {
        "method": "smartgrid_infer",
        "top_features": [
            {"feature": "recon_error", "value": float(result.get("recon_error", 0.0)), "importance": 0.5},
            {"feature": "xgb_conf", "value": float(result.get("xgb_conf", 0.0)), "importance": 0.3},
            {"feature": "ae_conf", "value": float(result.get("ae_conf", 0.0)), "importance": 0.2},
        ],
        "detected_by": result.get("detected_by", "unknown"),
        "group": result.get("group", "UNKNOWN"),
        "severity": result.get("severity", "LOW"),
        "ml_status": ml_status,
        "alert_severity": alert_severity,
        "attack_detected": attack_detected,
        "evaluation_failed": False,
    }

    return {
        "risk_score": round(risk_score, 4),
        "ml_status": ml_status,
        "alert_severity": alert_severity,
        "attack_detected": bool(attack_detected),
        "attack_class": attack_class,
        "confidence": round(confidence, 4),
        "model_version": "smartgrid-v2.1",
        "explanation": explanation,
    }


# ── Default / safe result builder ────────────────────────────

_SAFE_DEFAULTS: Dict[str, Any] = {
    "timestamp":    "",
    "src":          "unknown",
    "attack":       "ERROR",
    "group":        "ERROR",
    "severity":     "LOW",
    "risk_score":   0.0,
    "confidence":   0.0,
    "recon_error":  0.0,
    "is_anomaly":   False,
    "detected_by":  "",
    "action":       "Check engine logs",
    "is_blocked":   False,
    "actions_taken": [],
}


def _safe_result(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merge raw engine output with safe defaults so the response
    always contains every required field — even if the engine
    returned a partial or error dict.
    """
    out = dict(_SAFE_DEFAULTS)
    out.update({k: v for k, v in raw.items() if v is not None})

    # Normalise key: engine uses 'label', API uses 'attack'
    if "label" in raw and "attack" not in raw:
        out["attack"] = raw["label"]

    # Ensure timestamp is always set
    if not out.get("timestamp"):
        out["timestamp"] = datetime.utcnow().isoformat()

    return out


# ═══════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════

# ── Health ───────────────────────────────────────────────────

@app.get(
    "/health",
    summary="Liveness & readiness probe",
    tags=["System"],
)
async def health() -> Dict[str, Any]:
    """
    Returns the current status of the API and the NDR engine.

    - **status**: `"running"` when the API process is alive
    - **engine_ready**: `true` when models loaded successfully
    - **models_loaded**: mirrors `engine_ready`
    - **uptime_seconds**: seconds since the API process started
    """
    uptime = round(time.time() - _startup_time, 1)

    if not _engine_ready or _engine is None:
        return JSONResponse(
            status_code=503,
            content={
                "status":        "running",
                "engine_ready":  False,
                "models_loaded": False,
                "uptime_seconds": uptime,
                "detail":        "Engine failed to initialise — check server logs.",
            },
        )

    return {
        "status":         "running",
        "engine_ready":   True,
        "models_loaded":  True,
        "uptime_seconds": uptime,
        "models": {
            "xgboost_features":     len(_engine.xgb_feats),
            "autoencoder_features": len(_engine.ae_feats),
            "ae_threshold":         round(_engine.ae_threshold, 6),
        },
    }


@app.get("/healthz", tags=["Compatibility"])
async def healthz() -> Dict[str, str]:
    if not _engine_ready or _engine is None:
        raise HTTPException(status_code=503, detail="Engine is not ready")
    return {"status": "ok"}


@app.get("/readyz", tags=["Compatibility"])
async def readyz() -> Dict[str, str]:
    if not _engine_ready or _engine is None:
        raise HTTPException(status_code=503, detail="Engine is not ready")
    return {"status": "ready", "model_version": "smartgrid-v2.1"}


# ── Test ─────────────────────────────────────────────────────

# A realistic sample that typically triggers a TCPFLOOD detection.
_SAMPLE_FLOW = {
    "duration":    0.5,
    "sPackets":    2000,
    "rPackets":    5,
    "sBytesSum":   300000.0,
    "rBytesSum":   300.0,
    "sLoad":       4800000.0,
    "rLoad":       4800.0,
    "sSynRate":    0.0,
    "sAckRate":    1.0,
    "sFinRate":    0.0,
    "sRstRate":    0.0,
    "sPayloadAvg": 150.0,
    "rPayloadAvg": 60.0,
    "protocol":    "tcp",
    "sAddress":    "192.168.1.100",
}


@app.get(
    "/test",
    response_model=DetectionResult,
    summary="End-to-end smoke test",
    tags=["System"],
)
async def test_endpoint() -> Dict[str, Any]:
    """
    Runs the built-in sample flow through the full detection pipeline
    and returns the result.

    **Use this to:**
    - Verify the engine is working before integration
    - Give the frontend team a live example response
    - Let the attack simulation team confirm the API is reachable

    The sample simulates a TCP-flood pattern — you should see
    a HIGH or CRITICAL severity result.
    """
    engine = get_engine()
    try:
        raw = engine.predict_json(_SAMPLE_FLOW)
        return _safe_result(raw)
    except Exception as exc:
        logger.error("Test endpoint error: %s", exc)
        raise HTTPException(status_code=500, detail="Test prediction failed. Check server logs.")


# ── Predict (single) ─────────────────────────────────────────

@app.post(
    "/predict",
    response_model=DetectionResult,
    summary="Analyse a single network flow",
    tags=["Detection"],
)
async def predict(flow: NetworkFlow) -> Dict[str, Any]:
    """
    Submit a single network flow for detection.

    Returns a standardised result with:
    - **attack** label and **group** category
    - **severity** tier (CRITICAL / HIGH / MEDIUM / LOW)
    - **confidence** score (0–100 %)
    - **recon_error** from the Autoencoder
    - **action** recommended by the engine
    - **is_blocked** — whether the source IP was blocked this request
    - **actions_taken** — list of automated response actions executed
    """
    engine = get_engine()
    try:
        raw = engine.predict_json(flow.dict())
        return _safe_result(raw)
    except Exception as exc:
        logger.error("Prediction error: %s", exc)
        raise HTTPException(status_code=500, detail="Prediction failed. Check server logs.")


@app.post("/infer", tags=["Compatibility"])
async def infer(payload: InferRequest) -> Dict[str, Any]:
    engine = get_engine()
    try:
        flow = _convert_infer_to_flow(payload)
        raw = engine.predict_json(flow)
        merged = _merge_infer_engine_row(raw if isinstance(raw, dict) else {})
        return canonical_infer_contract(merged)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Infer error: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=f"Inference unavailable: {exc!s}",
        ) from exc


# ── Predict (batch) ──────────────────────────────────────────

@app.post(
    "/predict/batch",
    response_model=BatchResponse,
    summary="Analyse a batch of network flows",
    tags=["Detection"],
)
async def predict_batch(request: BatchRequest) -> Dict[str, Any]:
    """
    Submit 1–1000 flows in a single request.

    Returns:
    - **total**: number of flows processed
    - **results**: list of individual detection dicts
    - **summary**: aggregated attack_counts and severity_counts
    """
    engine  = get_engine()
    results: List[Dict[str, Any]] = []
    counts:  Dict[str, int]       = {}
    sevs:    Dict[str, int]       = {}

    for flow in request.flows:
        try:
            raw = engine.predict_json(flow.dict())
            r   = _safe_result(raw)
        except Exception as exc:
            logger.warning("Batch item error: %s", exc)
            r = dict(_SAFE_DEFAULTS)
            r["timestamp"] = datetime.utcnow().isoformat()
            r["attack"]    = "ERROR"

        results.append(r)
        lbl = r.get("attack", "ERROR")
        sev = r.get("severity", "LOW")
        counts[lbl] = counts.get(lbl, 0) + 1
        sevs[sev]   = sevs.get(sev, 0) + 1

    return {
        "total":   len(results),
        "results": results,
        "summary": {
            "attack_counts":   counts,
            "severity_counts": sevs,
        },
    }


# ── Session ──────────────────────────────────────────────────

@app.get(
    "/session/stats",
    summary="Current session statistics",
    tags=["Session"],
)
async def session_stats() -> Dict[str, Any]:
    """
    Returns aggregated statistics for the running session:
    - total flows analysed
    - per-attack-type counts
    - per-severity counts
    - currently blocked IPs
    """
    engine = get_engine()
    return engine.get_session_stats()


@app.post(
    "/session/reset",
    summary="Reset session state",
    tags=["Session"],
)
async def session_reset() -> Dict[str, Any]:
    """
    Clears session counters, blocked-IP set, and alert history.
    Call this between test runs to start fresh.
    """
    engine = get_engine()
    engine.reset_session()
    logger.info("Session reset.")
    return {"status": "ok", "message": "Session reset successfully."}


@app.post("/retrain", tags=["Compatibility"])
async def retrain(payload: RetrainRequest) -> Dict[str, Any]:
    if not _engine_ready or _engine is None:
        raise HTTPException(status_code=503, detail="Engine is not ready")

    return {
        "model_version": "smartgrid-v2.1",
        "label": f"Retrain requested by {payload.triggered_by}",
        "metrics": {
            "training_samples": 0,
            "classifier": "XGBoost",
            "anomaly": "Autoencoder",
            "retrain_job_id": payload.retrain_job_id,
            "mode": "static_artifacts",
        },
    }


# ═══════════════════════════════════════════════════════════════
# GLOBAL ERROR HANDLERS
# ═══════════════════════════════════════════════════════════════

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error":   exc.detail,
            "path":    str(request.url),
            "status":  exc.status_code,
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s — %s", request.url, exc)
    return JSONResponse(
        status_code=500,
        content={
            "error":  "An internal server error occurred.",
            "path":   str(request.url),
            "status": 500,
        },
    )
