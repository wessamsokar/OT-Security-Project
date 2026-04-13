"""
ndr_engine.py  ──  Production NDR Engine v2.0
═══════════════════════════════════════════════════════════════
AI-based Network Detection & Response for ICS/OT Smart Grid

Architecture:
  XGBoost      → known attack classification  (supervised)
  Autoencoder  → zero-day / anomaly detection (unsupervised)
  Fusion logic → upgraded decision table with attack grouping,
                 severity scoring, and SOC-style logging

Changes vs v1:
  ✔ Attack group abstraction (FLOOD_ATTACK, SCAN_ATTACK, …)
  ✔ 4-tier severity: CRITICAL / HIGH / MEDIUM / LOW
  ✔ Improved fusion — avoids false BENIGN on edge cases
  ✔ Calibrated confidence: blended XGB + AE signals
  ✔ Structured SOC logger (JSON + human-readable)
  ✔ Response simulator (block / alert / log)
  ✔ Standardised output dict for API/frontend
  ✔ Full error handling throughout
"""

from __future__ import annotations

import json
import logging
import os
import time
import warnings
from datetime import datetime
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

from tensorflow import keras

from utils.feature_engineering import engineer_features


# ═══════════════════════════════════════════════════════════════
# PATH CONFIGURATION
# ═══════════════════════════════════════════════════════════════

# Resolves to NDR_Project/ regardless of where the process is launched
# (terminal, uvicorn, Docker, pytest, etc.)
BASE_DIR = Path(__file__).resolve().parent.parent

_PATHS = {
    # models/
    "xgb_model":          BASE_DIR / "models"        / "xgboost_model.pkl",
    "autoencoder_model":  BASE_DIR / "models"        / "autoencoder_model.keras",
    # preprocessing/
    "label_encoder":      BASE_DIR / "preprocessing" / "label_encoder.pkl",
    "xgb_features":       BASE_DIR / "preprocessing" / "xgb_features.pkl",
    "ae_scaler":          BASE_DIR / "preprocessing" / "autoencoder_scaler.pkl",
    "ae_features":        BASE_DIR / "preprocessing" / "autoencoder_features.pkl",
    # config/
    "ae_thresholds":      BASE_DIR / "config"        / "autoencoder_thresholds.json",
}


# ═══════════════════════════════════════════════════════════════
# ATTACK INTELLIGENCE REGISTRY
# ═══════════════════════════════════════════════════════════════

# Attack → Group mapping
ATTACK_GROUPS: dict[str, str] = {
    "ACKFLOOD":    "FLOOD_ATTACK",
    "TCPFLOOD":    "FLOOD_ATTACK",
    "ICMPFLOOD":   "FLOOD_ATTACK",
    "PINGOFDEATH": "ICMP_ATTACK",
    "Smurf":       "FLOOD_ATTACK",
    "PORTSCAN":    "SCAN_ATTACK",
    "NMAP":        "SCAN_ATTACK",
    "WinNuke":     "EXPLOIT_ATTACK",
    "UNKNOWN":     "UNKNOWN_THREAT",
    "SUSPICIOUS":  "SUSPICIOUS",
    "BENIGN":      "BENIGN",
}

# Per-attack metadata
ATTACK_INFO: dict[str, dict] = {
    "BENIGN":      {"base_severity": 0,  "severity": "LOW",      "action": "Log & monitor",           "color": "🟢", "block": False, "alert": False},
    "ACKFLOOD":    {"base_severity": 8,  "severity": "HIGH",     "action": "Block source IP",          "color": "🔴", "block": True,  "alert": True},
    "TCPFLOOD":    {"base_severity": 8,  "severity": "HIGH",     "action": "Rate limit + block",       "color": "🔴", "block": True,  "alert": True},
    "ICMPFLOOD":   {"base_severity": 5,  "severity": "MEDIUM",   "action": "Rate limit ICMP",          "color": "🟡", "block": False, "alert": True},
    "PINGOFDEATH": {"base_severity": 7,  "severity": "HIGH",     "action": "Block oversized ICMP",     "color": "🔴", "block": True,  "alert": True},
    "PORTSCAN":    {"base_severity": 3,  "severity": "LOW",      "action": "Monitor + log",            "color": "🟡", "block": False, "alert": False},
    "NMAP":        {"base_severity": 4,  "severity": "MEDIUM",   "action": "Alert SOC team",           "color": "🟡", "block": False, "alert": True},
    "Smurf":       {"base_severity": 7,  "severity": "HIGH",     "action": "Block broadcast traffic",  "color": "🔴", "block": True,  "alert": True},
    "WinNuke":     {"base_severity": 8,  "severity": "HIGH",     "action": "Block OOB TCP packets",    "color": "🔴", "block": True,  "alert": True},
    "UNKNOWN":     {"base_severity": 6,  "severity": "MEDIUM",   "action": "Isolate + investigate",    "color": "🟠", "block": False, "alert": True},
    "SUSPICIOUS":  {"base_severity": 3,  "severity": "LOW",      "action": "Watch & log",              "color": "🟡", "block": False, "alert": False},
}

# Severity escalation thresholds (risk_score → severity label override)
SEVERITY_THRESHOLDS = {
    "CRITICAL": 90,
    "HIGH":     65,
    "MEDIUM":   35,
    "LOW":      0,
}

# Confidence thresholds
XGB_HIGH_CONF   = 0.75   # XGBoost trusted alone above this
XGB_LOW_CONF    = 0.50   # Below this → uncertain
AE_WEIGHT       = 0.35   # AE contribution to blended confidence


# ═══════════════════════════════════════════════════════════════
# STRUCTURED LOGGER
# ═══════════════════════════════════════════════════════════════

class SOCLogger:
    """
    Dual-output logger: JSON lines file + human-readable console.
    Format (JSON):
      timestamp | src_ip | attack | group | severity | confidence |
      risk_score | anomaly_err | model | action | is_blocked
    """

    def __init__(self, log_dir: str = "logs"):
        Path(log_dir).mkdir(exist_ok=True)
        ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.json_path = Path(log_dir) / f"ndr_{ts}.jsonl"
        self.txt_path  = Path(log_dir) / f"ndr_{ts}.log"

        # Human-readable logger
        self._logger = logging.getLogger("NDR")
        self._logger.setLevel(logging.DEBUG)
        if not self._logger.handlers:
            fh = logging.FileHandler(self.txt_path)
            fh.setFormatter(logging.Formatter(
                "%(asctime)s | %(levelname)-8s | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S"
            ))
            self._logger.addHandler(fh)

        self._json_fh = open(self.json_path, "a", buffering=1)
        print(f"📋 SOC Logger initialised → {self.json_path}")

    def log(self, result: dict) -> None:
        """Write one detection event to both outputs."""
        record = {
            "timestamp":   result.get("timestamp"),
            "src_ip":      result.get("src", "unknown"),
            "attack":      result.get("label"),
            "group":       result.get("group"),
            "severity":    result.get("severity"),
            "confidence":  result.get("confidence"),
            "risk_score":  result.get("risk_score"),
            "anomaly_err": result.get("recon_error"),
            "model":       result.get("detected_by"),
            "action":      result.get("action"),
            "is_blocked":  result.get("is_blocked", False),
            "xgb_label":   result.get("xgb_label"),
            "xgb_conf":    result.get("xgb_conf"),
        }
        self._json_fh.write(json.dumps(record) + "\n")

        level   = logging.WARNING if result.get("label") != "BENIGN" else logging.DEBUG
        msg     = (
            f"[{record['src_ip']}] {record['attack']:12s} | "
            f"Sev={record['severity']:8s} | Conf={record['confidence']:5.1f}% | "
            f"AE={record['anomaly_err']:.4f} | By={record['model']}"
        )
        self._logger.log(level, msg)

    def close(self):
        self._json_fh.close()

    def __del__(self):
        try:
            self.close()
        except Exception:
            pass


# ═══════════════════════════════════════════════════════════════
# RESPONSE SIMULATOR
# ═══════════════════════════════════════════════════════════════

class ResponseSimulator:
    """
    Simulates SOC automated response actions.
    In production: replace print statements with actual API calls.
    """

    def __init__(self):
        self._blocked_ips:  set[str]  = set()
        self._alerted_ips:  dict[str, float] = {}   # ip → last alert time
        self._alert_cooldown = 60.0   # seconds between repeat alerts per IP

    def execute(self, result: dict) -> dict:
        """
        Decide and execute a response. Returns enriched result.
        """
        label   = result["label"]
        src_ip  = result["src"]
        info    = ATTACK_INFO.get(label, ATTACK_INFO["UNKNOWN"])
        actions_taken: list[str] = []

        # ── Block IP ──
        if info["block"] and src_ip not in self._blocked_ips:
            self._block_ip(src_ip, label)
            self._blocked_ips.add(src_ip)
            result["is_blocked"] = True
            actions_taken.append("BLOCK_IP")
        else:
            result["is_blocked"] = False

        # ── Alert admin ──
        now = time.time()
        if info["alert"]:
            last = self._alerted_ips.get(src_ip, 0)
            if now - last > self._alert_cooldown:
                self._alert_admin(result)
                self._alerted_ips[src_ip] = now
                actions_taken.append("ALERT_ADMIN")

        # ── Always log ──
        actions_taken.append("LOGGED")
        result["actions_taken"] = actions_taken
        return result

    def _block_ip(self, ip: str, reason: str) -> None:
        print(f"   🚫 [BLOCK]  {ip} — reason: {reason}")
        # production: call firewall API / SDN controller

    def _alert_admin(self, result: dict) -> None:
        print(
            f"   📣 [ALERT]  {result['label']} from {result['src']} "
            f"| Severity: {result['severity']} | Conf: {result['confidence']}%"
        )
        # production: send to SIEM / PagerDuty / email


# ═══════════════════════════════════════════════════════════════
# NDR ENGINE v2
# ═══════════════════════════════════════════════════════════════

class NDREngine:

    def __init__(
        self,
        enable_logging: bool = True,
        enable_response: bool = True,
        log_dir: str = "logs",
    ):
        print("🔧 Loading NDR Engine v2.0 ...")

        # ── XGBoost ──
        try:
            self.xgb_model = joblib.load(_PATHS["xgb_model"])
            self.le        = joblib.load(_PATHS["label_encoder"])
            self.xgb_feats = joblib.load(_PATHS["xgb_features"])
            print(f"✅ XGBoost loaded     — {len(self.xgb_feats)} features")
        except FileNotFoundError as e:
            raise RuntimeError(f"XGBoost model files missing: {e}") from e

        # ── Autoencoder ──
        try:
            self.autoencoder = keras.models.load_model(
                _PATHS["autoencoder_model"], compile=False
            )
            self.ae_scaler = joblib.load(_PATHS["ae_scaler"])
            self.ae_feats  = joblib.load(_PATHS["ae_features"])
            print(f"✅ Autoencoder loaded — {len(self.ae_feats)} features")
        except FileNotFoundError as e:
            raise RuntimeError(f"Autoencoder files missing: {e}") from e

        # ── Thresholds ──
        try:
            with open(_PATHS["ae_thresholds"]) as f:
                t = json.load(f)
            self.ae_threshold = t["threshold_optimal"]
            self.ae_clip      = t.get("clip_range", [-10, 10])
            self.ae_mse_mean  = t.get("val_mse_mean", 1.0)
            self.ae_mse_std   = t.get("val_mse_std",  1.0)
            print(f"✅ AE threshold       — {self.ae_threshold:.6f}")
        except FileNotFoundError as e:
            raise RuntimeError(f"Threshold file missing: {e}") from e

        # ── Subsystems ──
        self.logger   = SOCLogger(log_dir)      if enable_logging  else None
        self.responder = ResponseSimulator()    if enable_response else None

        # ── Session state ──
        self.session_counts:  dict[str, int]   = {}
        self.alert_history:   list[dict]        = []

        print(f"✅ NDR Engine ready\n")

    # ───────────────────────────────────────────────────────────
    # PRIVATE HELPERS
    # ───────────────────────────────────────────────────────────

    def _align(self, df: pd.DataFrame, feature_list: list) -> pd.DataFrame:
        for f in feature_list:
            if f not in df.columns:
                df[f] = 0.0
        return df[feature_list]

    def _ae_score(self, eng: pd.DataFrame) -> tuple[float, float, bool]:
        """
        Returns (recon_error, calibrated_confidence_0_to_1, is_anomaly).
        Confidence is z-score normalised so it reflects how far above
        the training BENIGN distribution the sample sits.
        """
        X_ae     = self._align(eng.copy(), self.ae_feats)
        X_scaled = self.ae_scaler.transform(X_ae.values.astype(np.float64))
        X_scaled = np.clip(X_scaled, self.ae_clip[0], self.ae_clip[1])
        recon    = self.autoencoder.predict(X_scaled, verbose=0)
        err      = float(np.mean(np.square(X_scaled - recon)))

        # Normalise against training distribution
        z_score  = (err - self.ae_mse_mean) / (self.ae_mse_std + 1e-10)
        ae_conf  = float(np.clip(z_score / 6.0, 0.0, 1.0))   # z=6 → 100%

        return err, ae_conf, (err > self.ae_threshold)

    def _blended_confidence(
        self,
        xgb_conf: float,
        ae_conf: float,
        detected_by: str,
    ) -> float:
        """
        Blend XGBoost and AE confidence signals.
        When XGBoost is high-conf, it dominates.
        When AE contributes, it adds up to AE_WEIGHT.
        """
        if detected_by == "XGBoost":
            return xgb_conf
        if detected_by == "Autoencoder":
            return ae_conf
        # Fusion: weighted blend
        return (1 - AE_WEIGHT) * xgb_conf + AE_WEIGHT * ae_conf

    def _compute_severity(
        self,
        attack: str,
        confidence: float,
        recon_err: float,
        recurrence: int,
    ) -> tuple[str, float]:
        """
        Returns (severity_label, risk_score_0_to_100).

        Formula:
          base     = base_severity(attack) × confidence × 10
          ae_bonus = proportional to how far above threshold
          rec_pen  = repeat offender penalty (capped)
          → clamp to [0, 100]

        Then map score to CRITICAL / HIGH / MEDIUM / LOW.
        CRITICAL is reserved for attacks with base_severity ≥ 7
        that also have risk_score ≥ 90.
        """
        info      = ATTACK_INFO.get(attack, ATTACK_INFO["UNKNOWN"])
        base_sev  = info["base_severity"]

        base      = confidence * base_sev * 10.0
        ae_ratio  = recon_err / (self.ae_threshold + 1e-10)
        ae_bonus  = min((ae_ratio - 1.0) * 5.0, 20.0) if ae_ratio > 1 else 0.0
        rec_pen   = min(recurrence * 2.5, 20.0)

        score = round(min(base + ae_bonus + rec_pen, 100.0), 1)

        # Derive severity label
        if score >= SEVERITY_THRESHOLDS["CRITICAL"] and base_sev >= 7:
            severity = "CRITICAL"
        elif score >= SEVERITY_THRESHOLDS["HIGH"]:
            severity = "HIGH"
        elif score >= SEVERITY_THRESHOLDS["MEDIUM"]:
            severity = "MEDIUM"
        else:
            severity = "LOW"

        return severity, score

    # ───────────────────────────────────────────────────────────
    # CORE PREDICTION
    # ───────────────────────────────────────────────────────────

    def predict(self, row_df: pd.DataFrame) -> dict:
        """
        Run fusion detection on a single-row DataFrame.

        Fusion Decision Table (upgraded):
        ┌──────────────────────────┬────────────┬─────────────────────────────────┐
        │ XGBoost                  │ Autoencoder│ Decision                        │
        ├──────────────────────────┼────────────┼─────────────────────────────────┤
        │ Attack  conf ≥ HIGH_CONF │ any        │ Known Attack (XGBoost)          │
        │ Attack  conf ≥ LOW_CONF  │ anomaly    │ Known Attack (XGB+AE confirmed) │
        │ Attack  conf ≥ LOW_CONF  │ normal     │ SUSPICIOUS (log only)           │
        │ Attack  conf < LOW_CONF  │ anomaly    │ UNKNOWN (AE-led)                │
        │ Attack  conf < LOW_CONF  │ normal     │ BENIGN (both uncertain)         │
        │ BENIGN                   │ anomaly    │ UNKNOWN (zero-day)              │
        │ BENIGN                   │ normal     │ BENIGN (confirmed)              │
        └──────────────────────────┴────────────┴─────────────────────────────────┘
        """
        try:
            eng = engineer_features(row_df, fit_protocols=False)
        except Exception as e:
            return self._error_result(str(e))

        # ── XGBoost ──
        try:
            X_xgb     = self._align(eng.copy(), self.xgb_feats)
            xgb_enc   = self.xgb_model.predict(X_xgb)[0]
            xgb_prob  = self.xgb_model.predict_proba(X_xgb)[0]
            xgb_conf  = float(np.max(xgb_prob))
            xgb_label = str(self.le.inverse_transform([xgb_enc])[0])
        except Exception as e:
            return self._error_result(f"XGBoost error: {e}")

        # ── Autoencoder ──
        try:
            recon_err, ae_conf, is_anomaly = self._ae_score(eng)
        except Exception as e:
            return self._error_result(f"Autoencoder error: {e}")

        # ── Fusion ──
        if xgb_label != "BENIGN" and xgb_conf >= XGB_HIGH_CONF:
            final_label = xgb_label
            detected_by = "XGBoost"

        elif xgb_label != "BENIGN" and xgb_conf >= XGB_LOW_CONF and is_anomaly:
            final_label = xgb_label
            detected_by = "XGBoost+AE"

        elif xgb_label != "BENIGN" and xgb_conf >= XGB_LOW_CONF and not is_anomaly:
            final_label = "SUSPICIOUS"
            detected_by = "XGBoost(low-conf)"

        elif xgb_label != "BENIGN" and xgb_conf < XGB_LOW_CONF and is_anomaly:
            # XGBoost very uncertain but AE sees something → trust AE
            final_label = "UNKNOWN"
            detected_by = "Autoencoder"

        elif xgb_label != "BENIGN" and xgb_conf < XGB_LOW_CONF and not is_anomaly:
            # Both uncertain → conservatively benign (log at DEBUG)
            final_label = "BENIGN"
            detected_by = "Both(uncertain)"

        elif xgb_label == "BENIGN" and is_anomaly:
            final_label = "UNKNOWN"
            detected_by = "Autoencoder"

        else:
            final_label = "BENIGN"
            detected_by = "Both"

        # ── Calibrated confidence ──
        confidence = self._blended_confidence(xgb_conf, ae_conf, detected_by)

        # ── Source tracking ──
        src = (
            str(row_df["sAddress"].iloc[0])
            if "sAddress" in row_df.columns
            else str(row_df.index[0])
        )

        is_threat = final_label not in ("BENIGN",)
        self.session_counts[src] = (
            self.session_counts.get(src, 0) + (1 if is_threat else 0)
        )
        recurrence = self.session_counts[src]

        # ── Severity & risk ──
        severity, risk_score = self._compute_severity(
            final_label, confidence, recon_err, recurrence
        )

        info  = ATTACK_INFO.get(final_label, ATTACK_INFO["UNKNOWN"])
        group = ATTACK_GROUPS.get(final_label, "UNKNOWN_THREAT")

        result = {
            # ── Core ──
            "timestamp":   datetime.now().isoformat(),
            "src":         src,
            "label":       final_label,
            "group":       group,
            # ── Risk ──
            "severity":    severity,
            "risk_score":  risk_score,
            "action":      info["action"],
            # ── Confidence ──
            "confidence":  round(confidence * 100, 1),
            "xgb_conf":    round(xgb_conf * 100, 1),
            "ae_conf":     round(ae_conf * 100, 1),
            # ── Anomaly ──
            "recon_error": round(recon_err, 4),
            "is_anomaly":  is_anomaly,
            # ── Meta ──
            "detected_by": detected_by,
            "xgb_label":   xgb_label,
            "recurrence":  recurrence,
            "color":       info["color"],
            "is_blocked":  False,
            "actions_taken": [],
        }

        # ── Response ──
        if self.responder and final_label not in ("BENIGN",):
            result = self.responder.execute(result)

        # ── Logging ──
        if self.logger and final_label not in ("BENIGN",):
            self.logger.log(result)

        self.alert_history.append(result)
        return result

    def predict_json(self, row_dict: dict) -> dict:
        """
        Single-row prediction from a plain Python dict.
        Entrypoint for FastAPI / REST integration.
        """
        row_df = pd.DataFrame([row_dict])
        return self.predict(row_df)

    # ───────────────────────────────────────────────────────────
    # STREAM SIMULATION
    # ───────────────────────────────────────────────────────────

    def process_stream(
        self,
        csv_path: str,
        chunk_size: int = 1,
        delay: float = 0.05,
        max_rows: Optional[int] = None,
        silent_benign: bool = True,
    ) -> list[dict]:
        """
        Simulate real-time detection by streaming a CSV row-by-row.
        """
        print(f"\n{'='*68}")
        print(f"🚨 NDR ENGINE — Real-time Detection")
        print(f"   File      : {csv_path}")
        print(f"   Threshold : {self.ae_threshold:.6f}")
        print(f"{'='*68}\n")

        stats  = {"total": 0, "attacks": 0, "unknown": 0,
                  "suspicious": 0, "benign": 0}
        alerts: list[dict] = []

        for i, chunk in enumerate(pd.read_csv(csv_path, chunksize=chunk_size)):
            if max_rows is not None and i >= max_rows:
                break

            result = self.predict(chunk)
            stats["total"] += 1
            label = result["label"]

            if label == "BENIGN":
                stats["benign"] += 1
                if silent_benign:
                    if delay > 0:
                        time.sleep(delay)
                    continue
            elif label == "UNKNOWN":
                stats["unknown"] += 1
            elif label == "SUSPICIOUS":
                stats["suspicious"] += 1
            else:
                stats["attacks"] += 1

            ts_short = result["timestamp"][11:19]  # HH:MM:SS
            print(
                f"[{ts_short}] {result['color']} "
                f"{label:12s} | "
                f"Sev: {result['severity']:8s} ({result['risk_score']:5.1f}) | "
                f"Conf: {result['confidence']:5.1f}% | "
                f"AE: {result['recon_error']:.4f} | "
                f"By: {result['detected_by']}"
            )

            alerts.append(result)

            if delay > 0:
                time.sleep(delay)

        self._print_summary(stats, alerts)
        return alerts

    # ───────────────────────────────────────────────────────────
    # HELPERS
    # ───────────────────────────────────────────────────────────

    def _error_result(self, msg: str) -> dict:
        print(f"⚠️  Prediction error: {msg}")
        return {
            "timestamp":   datetime.now().isoformat(),
            "label":       "ERROR",
            "group":       "ERROR",
            "severity":    "LOW",
            "risk_score":  0.0,
            "confidence":  0.0,
            "action":      "Check engine logs",
            "error":       msg,
        }

    def _print_summary(self, stats: dict, alerts: list[dict]) -> None:
        total = max(stats["total"], 1)
        print(f"\n{'='*68}")
        print(f"📊 SESSION SUMMARY")
        print(f"{'='*68}")
        print(f"  Total flows     : {stats['total']}")
        print(f"  Known attacks   : {stats['attacks']:4d}  ({stats['attacks']/total*100:.1f}%)")
        print(f"  Zero-day/Unknown: {stats['unknown']:4d}")
        print(f"  Suspicious      : {stats['suspicious']:4d}")
        print(f"  Benign          : {stats['benign']:4d}  ({stats['benign']/total*100:.1f}%)")

        if alerts:
            for sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
                grp = [a for a in alerts if a.get("severity") == sev]
                if grp:
                    icon = {"CRITICAL": "🔴🔴", "HIGH": "🔴", "MEDIUM": "🟠", "LOW": "🟡"}[sev]
                    print(f"\n  {icon} {sev} alerts : {len(grp)}")
                    for atk, cnt in (
                        pd.Series([a["label"] for a in grp]).value_counts().items()
                    ):
                        info = ATTACK_INFO.get(atk, ATTACK_INFO["UNKNOWN"])
                        print(f"     {info['color']} {atk}: {cnt}  →  {info['action']}")

        print(f"{'='*68}\n")

    def get_session_stats(self) -> dict:
        """Return session statistics for API/dashboard consumption."""
        total  = len(self.alert_history)
        labels = [a["label"] for a in self.alert_history]
        sevs   = [a.get("severity", "LOW") for a in self.alert_history]
        return {
            "total_flows":   total,
            "attack_counts": pd.Series(labels).value_counts().to_dict(),
            "severity_counts": pd.Series(sevs).value_counts().to_dict(),
            "blocked_ips":   list(self.responder._blocked_ips) if self.responder else [],
        }

    def reset_session(self) -> None:
        """Reset per-session state (call between vendor tests)."""
        self.session_counts = {}
        self.alert_history  = []
        if self.responder:
            self.responder._blocked_ips.clear()
            self.responder._alerted_ips.clear()


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    engine = NDREngine(enable_logging=True, enable_response=True)

    print("🏭 VENDOR: Siemens")
    siemens_alerts = engine.process_stream(
        "Datasets/03_cross_vendor/Siemens_pingofdeath_0710-.csv",
        max_rows=200,
        delay=0.01,
    )

    print("\n🏭 VENDOR: Schneider")
    engine.reset_session()
    schneider_alerts = engine.process_stream(
        "Datasets/03_cross_vendor/Schneider_portscan_0710.csv",
        max_rows=363,
        delay=0.01,
    )

    # Combined session summary
    all_alerts = siemens_alerts + schneider_alerts
    print(f"📋 Full alert log (first 10 of {len(all_alerts)}):")
    for a in all_alerts[:10]:
        ts = a["timestamp"][11:19]
        print(
            f"   [{ts}] {a['color']} {a['label']:12s}  "
            f"conf={a['confidence']}%  sev={a['severity']}  by={a['detected_by']}"
        )
    if len(all_alerts) > 10:
        print(f"   ... and {len(all_alerts) - 10} more")
