# System Summary & Improvements

## Overview

This document summarises what was built, what was improved, and what each team needs to know before starting integration.

The system is a production-ready AI-based Network Detection and Response (NDR) engine for ICS/OT environments. It detects, classifies, and responds to network threats in smart grid infrastructure using a hybrid AI approach combining two models working in parallel.

---

## What Was Built

### Core components delivered

| Component | File | Description |
|-----------|------|-------------|
| Detection engine | `engine/ndr_engine.py` | Full fusion logic, risk scoring, logging, response |
| REST API | `api/api.py` | FastAPI with 6 endpoints, Pydantic validation, error handling |
| XGBoost model | `models/xgboost_model.pkl` | Trained classifier for known attack types |
| Autoencoder model | `models/autoencoder_model.keras` | Trained anomaly detector for zero-day threats |
| Preprocessing | `preprocessing/` | Scalers, feature lists, label encoder — all serialised |
| Feature engineering | `utils/feature_engineering.py` | Raw flow → derived feature transformation |
| Config | `config/autoencoder_thresholds.json` | Optimal threshold + calibration values |
| Datasets | `Datasets/` | 3-layer dataset covering ABB, Siemens, Schneider |

### What the system does end-to-end

A network flow comes in as a JSON request. The feature engineering pipeline transforms it into the feature vectors each model expects. XGBoost runs supervised classification and returns a label plus a confidence score. The Autoencoder reconstructs the input and calculates how different it is from normal traffic. The fusion engine combines both signals using a 7-case decision table and produces a single verdict — including attack type, severity, risk score, recommended action, and whether the source IP was blocked.

---

## Key Improvements Made

### Engine improvements

- Fixed all file path issues using `pathlib` and `BASE_DIR = Path(__file__).resolve().parent.parent`
- Centralised all model and config loading into a single `_PATHS` dictionary
- Paths now resolve correctly in all environments: local terminal, uvicorn, and Docker
- No hardcoded filenames — everything uses structured path references

### API improvements

**Added `/test` endpoint**
Runs a built-in TCP flood sample through the full pipeline without requiring any input. Designed specifically so the frontend team and attack simulation team can verify the system is working immediately after deployment — no data preparation needed.

**Improved `/health` endpoint**
Now returns `engine_ready`, `models_loaded`, and `uptime_seconds` in a consistent structure. If the engine failed to load, it returns HTTP 503 with a clear message instead of crashing.

**Added `_safe_result()` function**
Every response from `/predict` and `/predict/batch` now always includes all required fields — even if the engine returned a partial result or an error. No missing keys, no `KeyError` on the frontend.

**Error handling**
Raw Python exceptions are no longer exposed in API responses. All errors return clean JSON messages. HTTP errors and unhandled exceptions are handled by separate handlers with consistent structure.

**Logging directory**
`logs/` is created automatically at startup before the engine initialises. No crashes if the directory does not exist.

**Import paths**
Fixed to use `from engine.ndr_engine import NDREngine` — correct for Docker and module-based execution.

### System stability

- All API responses follow a fixed schema — no optional or missing fields
- Handles incomplete or missing input fields safely using Pydantic defaults
- Batch endpoint processes each flow independently — a single failure does not abort the whole batch
- Engine loads once at startup and stays in memory — no per-request model loading

---

## Integration Readiness

### Backend team

The API is ready to consume directly. Your responsibilities:

- Call `GET /health` at startup to confirm the engine loaded before accepting traffic
- Forward detection requests to `POST /predict` or `POST /predict/batch`
- Store results in your database — the full response dict is structured and consistent
- Add JWT or API key authentication at your proxy layer before exposing to clients
- Use `GET /session/stats` to power any summary endpoints you build
- Call `POST /session/reset` between isolated test scenarios

The engine has no authentication — do not expose it directly to external clients.

### Frontend team

All data needed for a dashboard is in the response. Start with these:

- `GET /test` — gives you a real response immediately with no setup
- `GET /session/stats` — poll every few seconds for live session data
- `GET /health` — use for a system status indicator

Fields to display:

| Field | Display as |
|-------|-----------|
| `attack` | Attack type label |
| `group` | Category badge |
| `severity` | Colour-coded pill (CRITICAL=red, HIGH=orange, MEDIUM=yellow, LOW=green) |
| `risk_score` | Gauge or bar (0–100) |
| `confidence` | Percentage |
| `detected_by` | Model attribution |
| `action` | Recommended action text |
| `is_blocked` | Blocked / not blocked indicator |
| `src` | Source IP |

### DevOps team

The system is containerised-ready. Minimal Dockerfile:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "api.api:app", "--host", "0.0.0.0", "--port", "8000"]
```

Health check for orchestration:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

Mount logs as a volume for SIEM forwarding:

```yaml
volumes:
  - ./logs:/app/logs
```

### Attack simulation team

**Step 1 — Confirm the system is up:**
```bash
curl http://localhost:8000/health
```

**Step 2 — Run the built-in test:**
```bash
curl http://localhost:8000/test
```
Expected result: TCPFLOOD at HIGH or CRITICAL severity.

**Step 3 — Send custom flows:**
```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"sPackets": 5000, "rPackets": 2, "sAckRate": 1.0, "protocol": "tcp", "sAddress": "10.0.0.1"}'
```

**Step 4 — Check session stats:**
```bash
curl http://localhost:8000/session/stats
```

**Step 5 — Reset between scenarios:**
```bash
curl -X POST http://localhost:8000/session/reset
```

---

## Current Limitations

These are known gaps documented for the team — not bugs, but scope boundaries of the current system.

- **No deep packet inspection** — the system works at the flow level, not packet payload level
- **No ICS protocol parsing** — Modbus, DNP3, and IEC 104 command structures are not analysed
- **No MITM or ARP spoofing detection** — requires Layer 2 analysis beyond flow statistics
- **No replay attack detection** — requires sequence number tracking at the protocol level
- **Simulated response only** — IP blocking and alerting are logged but not connected to a real firewall

---

## Next Steps

These are the recommended development priorities for the next phase:

1. Connect real firewall API to replace simulated blocking
2. Add authentication (JWT or API key) at the backend proxy layer
3. Build frontend dashboard using `/predict` and `/session/stats`
4. Containerise with Docker and connect logs to Elasticsearch or Splunk
5. Add ICS protocol parsers for Modbus, DNP3, IEC 104
6. Integrate real-time traffic streaming via Kafka or MQTT
7. Add SHAP explainability so analysts can understand model decisions
8. Implement drift detection to catch when traffic patterns shift away from training data
