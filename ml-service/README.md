# ICS-OT Smart Grid — Network Detection & Response (AI-Based)

## Overview

This project implements a production-ready AI-based Network Detection and Response (NDR) system designed for Industrial Control Systems (ICS/OT) in Smart Grid environments.

The system analyzes industrial network traffic, detects anomalies, classifies cyber attacks, and triggers automated response actions to protect critical infrastructure such as substations and power systems.

---

## Objectives

- Detect abnormal behavior in industrial network traffic
- Classify cyber attacks (DoS, scanning, flooding, exploitation, etc.)
- Support real-time monitoring and alerting
- Generalize detection across multiple industrial vendors (ABB, Siemens, Schneider)

---

## Key Features

- Real-time traffic analysis (simulated streaming)
- Hybrid AI detection:
  - XGBoost for known attack classification
  - Autoencoder for anomaly and zero-day detection
  - Fusion logic combining both models for a single confident verdict
- 4-tier severity classification: LOW / MEDIUM / HIGH / CRITICAL
- Attack grouping: Flood, Scan, Exploit, ICMP, Unknown
- Structured SOC-style logging (JSON + human-readable)
- Automated response simulation: block, alert, log
- REST API built with FastAPI
- Ready for frontend dashboard, backend, and Docker integration

---

## Project Structure

```
NDR_Project/
│
├── api/                          ← FastAPI endpoints
│   └── api.py
├── engine/                       ← Core detection logic
│   └── ndr_engine.py
├── models/                       ← Trained ML models
│   ├── xgboost_model.pkl
│   └── autoencoder_model.keras
├── preprocessing/                ← Scalers, feature lists, label encoder
│   ├── xgb_features.pkl
│   ├── label_encoder.pkl
│   ├── autoencoder_scaler.pkl
│   └── autoencoder_features.pkl
├── config/                       ← Runtime thresholds
│   └── autoencoder_thresholds.json
├── utils/                        ← Feature engineering pipeline
│   └── feature_engineering.py
├── Datasets/
│   ├── 01_core/
│   ├── 02_diversity/
│   └── 03_cross_vendor/
│
├── requirements.txt
├── README.md
├── SYSTEM_DESIGN.md
└── SYSTEM_SUMMARY.md
```

---

## Installation

```bash
pip install -r requirements.txt
```

---

## Running the System

```bash
uvicorn api.api:app --host 0.0.0.0 --port 8000
```

Interactive API docs:

```
http://127.0.0.1:8000/docs
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/predict` | Analyse a single network flow |
| POST | `/predict/batch` | Analyse up to 1000 flows at once |
| GET | `/test` | Run built-in sample — no input needed |
| GET | `/health` | Engine status and model readiness |
| GET | `/session/stats` | Current session statistics |
| POST | `/session/reset` | Reset session between test runs |

---

## Quick Test

After starting the server, verify everything is working:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/test
```

The `/test` endpoint runs a built-in TCP flood sample and returns a full detection result — no data preparation needed.

---

## Example — POST /predict

**Request:**

```json
{
  "duration": 0.5,
  "sPackets": 2000,
  "rPackets": 5,
  "sBytesSum": 300000,
  "rBytesSum": 300,
  "sLoad": 4800000,
  "rLoad": 4800,
  "sSynRate": 0.0,
  "sAckRate": 1.0,
  "sFinRate": 0.0,
  "sRstRate": 0.0,
  "sPayloadAvg": 150,
  "rPayloadAvg": 60,
  "protocol": "tcp",
  "sAddress": "192.168.1.10"
}
```

**Response:**

```json
{
  "timestamp": "2025-07-15T14:22:10.331Z",
  "src": "192.168.1.10",
  "attack": "TCPFLOOD",
  "group": "FLOOD_ATTACK",
  "severity": "HIGH",
  "risk_score": 78.4,
  "confidence": 96.2,
  "recon_error": 0.0182,
  "is_anomaly": true,
  "detected_by": "XGBoost",
  "action": "Rate limit + block",
  "is_blocked": true,
  "actions_taken": ["BLOCK_IP", "ALERT_ADMIN", "LOGGED"]
}
```

---

## Detection Logic

The system uses a hybrid AI approach combining two models:

**XGBoost** — supervised model trained on labeled attack data. Detects known attack patterns with high confidence and returns an attack label plus a probability score.

**Autoencoder** — unsupervised model trained exclusively on normal traffic. Detects anything that deviates from learned normal behavior, including zero-day attacks.

**Fusion engine** — combines both model outputs using a 7-case decision table. The final verdict considers confidence level from XGBoost and anomaly signal from the Autoencoder together, which significantly reduces false positives.

See `SYSTEM_DESIGN.md` for the full fusion logic and risk scoring details.

---

## Supported Attack Types

**Known attacks (XGBoost):**
TCP Flood, ACK Flood, ICMP Flood, Ping of Death, Smurf, WinNuke, Port Scan, Nmap

**Unknown / Zero-Day (Autoencoder):**
Any network behavior that deviates from learned normal industrial traffic patterns

---

## Datasets

```
Datasets/
├── 01_core/          ← ABB baseline — used for model training
├── 02_diversity/     ← 9 attack types — improves generalization
└── 03_cross_vendor/  ← Siemens + Schneider — cross-environment testing
```

---

## Limitations

- No MITM or ARP spoofing detection (requires Layer 2 analysis)
- No replay attack detection (requires protocol-level sequence tracking)
- No deep packet inspection for ICS protocols (Modbus, DNP3, IEC 104)

---

## Future Improvements

- Real firewall integration to replace simulated IP blocking
- Real-time streaming via Kafka or MQTT
- Frontend monitoring dashboard
- ICS protocol parsers (Modbus, DNP3, IEC 104)
- SHAP-based explainability for model decisions
- Drift detection for evolving traffic patterns

---

## Use Cases

- Smart Grid security monitoring
- Industrial network intrusion detection
- SOC automation for ICS/OT environments

---

## Status

- Production-ready
- API integrated and documented
- Full detection pipeline implemented
- Cross-vendor tested (ABB, Siemens, Schneider)
