from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import Any

import numpy as np
from fastapi import FastAPI, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from pydantic import BaseModel, Field
from sklearn.ensemble import IsolationForest, RandomForestClassifier

FEATURE_ORDER = [
    "packet_count",
    "bytes_in",
    "bytes_out",
    "duration_ms",
    "payload_entropy",
    "source_port",
    "destination_port",
    "modbus_function_code",
    "modbus_unit_id",
    "dnp3_function_code",
    "iec104_type_id",
    "transport_protocol_code",
]

TRANSPORT_MAP = {"tcp": 0, "udp": 1, "icmp": 2}
ATTACK_LABELS = ["normal", "scan", "dos", "command_injection", "spoofing"]

INFER_COUNT = Counter("ml_inference_requests_total", "Total inference requests")
INFER_LATENCY = Histogram("ml_inference_latency_seconds", "ML inference latency")


class InferRequest(BaseModel):
    packet_count: int = Field(ge=1)
    bytes_in: int = Field(ge=0)
    bytes_out: int = Field(ge=0)
    duration_ms: float = Field(ge=0)
    payload_entropy: float = Field(ge=0, le=8)
    source_port: int = Field(ge=1, le=65535)
    destination_port: int = Field(ge=1, le=65535)
    modbus_function_code: int | None = Field(default=0, ge=0, le=255)
    modbus_unit_id: int | None = Field(default=0, ge=0, le=255)
    dnp3_function_code: int | None = Field(default=0, ge=0, le=255)
    iec104_type_id: int | None = Field(default=0, ge=0, le=255)
    transport_protocol: str = Field(pattern="^(tcp|udp|icmp)$")


class RetrainRequest(BaseModel):
    triggered_by: str = "system"
    retrain_job_id: str | None = None


@dataclass
class ModelBundle:
    anomaly_model: IsolationForest
    classifier: RandomForestClassifier
    version: str


class ModelManager:
    def __init__(self) -> None:
        self.version_counter = 1
        self.bundle = self._train_bundle()

    def _build_dataset(self, n: int = 1500) -> tuple[np.ndarray, np.ndarray]:
        rng = np.random.default_rng(42 + self.version_counter)
        X = np.zeros((n, len(FEATURE_ORDER)), dtype=float)

        X[:, 0] = rng.normal(35, 18, n).clip(1, 400)
        X[:, 1] = rng.normal(1800, 850, n).clip(0, 30000)
        X[:, 2] = rng.normal(1400, 780, n).clip(0, 30000)
        X[:, 3] = rng.normal(120, 95, n).clip(0, 3000)
        X[:, 4] = rng.normal(3.2, 1.0, n).clip(0, 8)
        X[:, 5] = rng.integers(1024, 65535, n)
        X[:, 6] = rng.choice([502, 20000, 2404, 44818], n)
        X[:, 7] = rng.choice([1, 3, 4, 5, 6, 16], n)
        X[:, 8] = rng.integers(1, 32, n)
        X[:, 9] = rng.choice([0, 1, 2, 3, 5], n)
        X[:, 10] = rng.choice([1, 3, 9, 13, 45, 100], n)
        X[:, 11] = rng.choice([0, 1], n)

        y = np.zeros(n, dtype=int)
        scan_idx = (X[:, 0] > 70) & (X[:, 3] < 60)
        dos_idx = X[:, 0] > 120
        cmd_idx = (X[:, 4] > 5.7) & np.isin(X[:, 7], [5, 6, 16])
        spoof_idx = (X[:, 5] < 2000) & (X[:, 2] > 2500)

        y[scan_idx] = 1
        y[dos_idx] = 2
        y[cmd_idx] = 3
        y[spoof_idx] = 4

        return X, y

    def _train_bundle(self) -> ModelBundle:
        X, y = self._build_dataset()

        anomaly = IsolationForest(contamination=0.12, random_state=42 + self.version_counter)
        anomaly.fit(X)

        clf = RandomForestClassifier(n_estimators=180, random_state=42 + self.version_counter)
        clf.fit(X, y)

        version = f"v{self.version_counter}.0"
        return ModelBundle(anomaly_model=anomaly, classifier=clf, version=version)

    def infer(self, req: InferRequest) -> dict[str, Any]:
        vector = np.array([
            req.packet_count,
            req.bytes_in,
            req.bytes_out,
            req.duration_ms,
            req.payload_entropy,
            req.source_port,
            req.destination_port,
            req.modbus_function_code or 0,
            req.modbus_unit_id or 0,
            req.dnp3_function_code or 0,
            req.iec104_type_id or 0,
            TRANSPORT_MAP[req.transport_protocol],
        ], dtype=float)

        X = vector.reshape(1, -1)
        anomaly_score = -float(self.bundle.anomaly_model.score_samples(X)[0])
        normalized_anomaly = min(max((anomaly_score + 0.5) / 1.5, 0.0), 1.0)

        probs = self.bundle.classifier.predict_proba(X)[0]
        predicted_class_idx = int(np.argmax(probs))
        predicted_class = ATTACK_LABELS[predicted_class_idx]
        confidence = float(probs[predicted_class_idx])

        risk_score = float(min(max(0.6 * normalized_anomaly + 0.4 * confidence, 0.0), 1.0))
        explain = self._explain(vector)

        return {
            "risk_score": round(risk_score, 4),
            "attack_class": predicted_class,
            "confidence": round(confidence, 4),
            "model_version": self.bundle.version,
            "explanation": explain,
        }

    def _explain(self, vector: np.ndarray) -> dict[str, Any]:
        importances = self.bundle.classifier.feature_importances_
        contribution = importances * np.abs(vector)
        top_idx = np.argsort(contribution)[-4:][::-1]

        top_features = [
            {
                "feature": FEATURE_ORDER[int(idx)],
                "value": float(vector[int(idx)]),
                "importance": float(importances[int(idx)]),
            }
            for idx in top_idx
        ]

        return {
            "method": "feature_importance_fallback",
            "top_features": top_features,
        }

    def retrain(self, triggered_by: str) -> dict[str, Any]:
        self.version_counter += 1
        self.bundle = self._train_bundle()
        return {
            "model_version": self.bundle.version,
            "label": f"Retrained by {triggered_by}",
            "metrics": {"training_samples": 1500, "classifier": "RandomForest", "anomaly": "IsolationForest"},
        }


model_manager = ModelManager()
app = FastAPI(title="ICS ML Service")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readyz")
def readyz() -> dict[str, str]:
    return {"status": "ready", "model_version": model_manager.bundle.version}


@app.get("/metrics")
def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/infer")
def infer(payload: InferRequest) -> dict[str, Any]:
    INFER_COUNT.inc()
    start = perf_counter()
    result = model_manager.infer(payload)
    INFER_LATENCY.observe(perf_counter() - start)
    return result


@app.post("/retrain")
def retrain(payload: RetrainRequest) -> dict[str, Any]:
    return model_manager.retrain(payload.triggered_by)
