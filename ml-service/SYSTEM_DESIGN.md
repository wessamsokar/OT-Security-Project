# System Design & Architecture

## Overview

This document describes the internal architecture and production design of the AI-based Network Detection and Response (NDR) system.

The system is designed to operate in industrial environments (ICS/OT), providing real-time detection, classification, and response to cyber threats in smart grid networks.

---

## NDR Pipeline Architecture

```
RAW TRAFFIC (PCAP / NetFlow / IPFIX)
          ↓
Feature Engineering (utils/feature_engineering.py)
          ↓
 ┌────────────────────────┬─────────────────────────┐
 ↓                        ↓
XGBoost                  Autoencoder
(Supervised)             (Unsupervised)
Known attack label       Reconstruction error
+ confidence score       + anomaly flag
 ↓                        ↓
 └──────────── Fusion Engine ─────────────┘
                    ↓
           Risk Scoring Engine
                    ↓
      ┌─────────────┴──────────────┐
      ↓                            ↓
Auto Response              SOC Logger
(Block / Alert / Log)      (JSON + .log)
                    ↓
         Unified API Response
```

---

## Component Responsibilities

| Component | File | Role |
|-----------|------|------|
| API layer | `api/api.py` | Request validation, routing, response formatting |
| Detection engine | `engine/ndr_engine.py` | Fusion logic, risk scoring, response, logging |
| XGBoost model | `models/xgboost_model.pkl` | Known attack classification |
| Autoencoder model | `models/autoencoder_model.keras` | Anomaly / zero-day detection |
| Feature engineering | `utils/feature_engineering.py` | Raw flow → derived features |
| Preprocessing | `preprocessing/` | Scalers, feature lists, label encoder |
| Config | `config/autoencoder_thresholds.json` | Anomaly threshold + calibration values |

---

## Fusion Logic

The fusion engine combines outputs from both models using a 7-case decision table. The goal is to maximise detection accuracy while minimising false positives — a priority in industrial environments where a wrongly blocked connection can disable physical equipment.

| XGBoost result | Autoencoder result | Final decision | Detected by |
|---|---|---|---|
| Attack, confidence ≥ 75% | Any | Known attack — trusted | XGBoost |
| Attack, confidence 50–75% | Anomaly | Known attack — confirmed | XGBoost + AE |
| Attack, confidence 50–75% | Normal | Suspicious — log only | XGBoost (low-conf) |
| Attack, confidence < 50% | Anomaly | Unknown threat | Autoencoder |
| Attack, confidence < 50% | Normal | Benign — both uncertain | Both (uncertain) |
| Benign | Anomaly | Unknown / zero-day | Autoencoder |
| Benign | Normal | Benign — confirmed | Both |

**Why this reduces false positives:** Neither model triggers a block when it is uncertain. If XGBoost is unsure and the Autoencoder sees nothing unusual, the system defaults to benign rather than raising a false alarm.

---

## Risk Scoring System

The risk score is a value between 0 and 100 calculated dynamically for each detection event.

### Formula

```python
risk_score = (confidence × base_severity × 10)
           + anomaly_bonus        # max +20 — based on how far AE error exceeds threshold
           + recurrence_penalty   # max +20 — repeat offender from same IP

risk_score = min(risk_score, 100)
```

`base_severity` is a fixed value per attack type defined in the attack intelligence registry (scale of 0–10).

### Severity tiers

| Score | Severity | Action |
|---|---|---|
| 90+ (and base_severity ≥ 7) | CRITICAL | Immediate block + alert |
| 65–89 | HIGH | Block + alert |
| 35–64 | MEDIUM | Alert analyst |
| 0–34 | LOW | Log and monitor |

### IP recurrence tracking

The engine counts how many non-benign events each source IP has triggered in the current session. Repeat offenders receive a higher risk score, making it more likely they escalate to CRITICAL and get blocked automatically.

---

## Attack Intelligence Registry

Every known attack type has fixed metadata controlling how the engine responds.

| Attack | Group | Base severity | Auto-block | Alert SOC |
|---|---|---|---|---|
| TCPFLOOD | FLOOD_ATTACK | 8 | Yes | Yes |
| ACKFLOOD | FLOOD_ATTACK | 8 | Yes | Yes |
| ICMPFLOOD | FLOOD_ATTACK | 5 | No | Yes |
| PINGOFDEATH | ICMP_ATTACK | 7 | Yes | Yes |
| Smurf | FLOOD_ATTACK | 7 | Yes | Yes |
| PORTSCAN | SCAN_ATTACK | 3 | No | No |
| NMAP | SCAN_ATTACK | 4 | No | Yes |
| WinNuke | EXPLOIT_ATTACK | 8 | Yes | Yes |
| UNKNOWN | UNKNOWN_THREAT | 6 | No | Yes |
| SUSPICIOUS | SUSPICIOUS | 3 | No | No |
| BENIGN | BENIGN | 0 | No | No |

`UNKNOWN` is the zero-day path — triggered when the Autoencoder detects an anomaly but XGBoost cannot classify it with sufficient confidence.

---

## Blended Confidence Score

The final confidence value shown in the API response is a weighted blend of both model signals.

- XGBoost drives alone → confidence = XGBoost probability
- Autoencoder drives alone → confidence = Autoencoder anomaly score (z-score normalised)
- Both contribute (fusion) → confidence = (0.65 × XGBoost) + (0.35 × Autoencoder)

---

## Logging System

Two log files are created per session in the `logs/` directory. The directory is created automatically if it does not exist.

**JSON log (`ndr_YYYYMMDD_HHMMSS.jsonl`)** — one event per line, structured for SIEM ingestion (Elasticsearch, Splunk):

```json
{
  "timestamp": "2025-07-15T14:22:10.331Z",
  "src_ip": "192.168.1.10",
  "attack": "TCPFLOOD",
  "group": "FLOOD_ATTACK",
  "severity": "HIGH",
  "confidence": 96.2,
  "risk_score": 78.4,
  "anomaly_err": 0.0182,
  "model": "XGBoost",
  "action": "Rate limit + block",
  "is_blocked": true
}
```

**Text log (`ndr_YYYYMMDD_HHMMSS.log`)** — human-readable format for live monitoring:

```
2025-07-15 14:22:10 | WARNING  | [192.168.1.10] TCPFLOOD | Sev=HIGH | Conf=96.2% | AE=0.0182 | By=XGBoost
```

Only non-benign events are written to logs. Benign traffic is tracked internally but not logged to keep files clean.

---

## Response System

When an attack is detected, the response simulator executes automated actions before returning the result.

**Block IP** — if `block: true` in the attack registry, the source IP is added to a blocked set. In the current implementation this is simulated. In production, replace with a call to your firewall or SDN controller.

**Alert admin** — if `alert: true`, an alert is triggered. A 60-second cooldown per source IP prevents the same IP from flooding the SOC with repeated alerts.

**Always logged** — every non-benign detection is written to both log outputs regardless of block or alert settings.

The `actions_taken` field in every response shows exactly what happened:

```json
"actions_taken": ["BLOCK_IP", "ALERT_ADMIN", "LOGGED"]
```

---

## API Design

All endpoints return consistent JSON. Every response from `/predict` always includes all fields — no missing keys, even on partial results or errors.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/predict` | Detect on a single network flow |
| POST | `/predict/batch` | Detect on up to 1000 flows |
| GET | `/test` | Run built-in sample — no input needed |
| GET | `/health` | Engine status and model readiness |
| GET | `/session/stats` | Aggregated session statistics |
| POST | `/session/reset` | Reset session between test runs |

**Health response:**
```json
{
  "status": "running",
  "engine_ready": true,
  "models_loaded": true,
  "uptime_seconds": 142.3
}
```

---

## System Characteristics

- Low-latency inference — both models run in memory, loaded once at startup
- Hybrid AI — supervised + unsupervised working together
- Modular — each component has a single responsibility and can be replaced independently
- Environment-agnostic — dynamic path resolution via `pathlib`, works locally, in Docker, and under uvicorn
- SIEM-compatible — structured JSON logs ready for Elasticsearch or Splunk

---

## Limitations

The current system does not cover:

- **MITM / ARP Spoofing** — requires Layer 2 traffic analysis and MAC address tracking
- **Replay attacks** — requires protocol-level sequence number analysis
- **Data manipulation attacks** — requires deep packet inspection and ICS payload semantics
- **ICS protocol parsing** — Modbus, DNP3, IEC 104 need dedicated protocol parsers

---

## Future Improvements

- Real firewall integration (replace simulated IP blocking)
- Real-time streaming via Kafka or MQTT
- ICS protocol parsers (Modbus, DNP3, IEC 104)
- Model versioning with MLflow
- Drift detection for evolving traffic patterns
- SHAP-based explainability for each prediction
- Frontend real-time monitoring dashboard
- Threat intelligence feed integration
