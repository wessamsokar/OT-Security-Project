# OT Sentinel AI Platform

OT Sentinel AI is a production-oriented OT/ICS detection and response platform with a React SOC UI, a FastAPI backend, PostgreSQL, Redis + Celery for async work, and an internal ML inference service. It focuses on live telemetry ingestion, topology-aware visibility, and multi-tenant RBAC enforcement.

## Project Overview

The platform ingests OT network flows, runs ML-assisted detection, persists alerts and device state, and streams live SOC updates over SSE. A tenant-aware topology engine tracks relationships between devices and surfaces operational state and traffic activity in the UI.

## Features

- Live OT telemetry ingestion and ML detection workflow
- SOC dashboards (alerts, active threats, SOC health, MTTR)
- Multi-tenant RBAC with permission enforcement on every route
- Tenant-scoped topology graph with React Flow visualization
- SSE streams for alerts and topology snapshots
- Device operational state derived from telemetry + ML status
- Packet capture workflows (Scapy-based) for privileged hosts
- Audit logging for auth, detection, permission denials, and runtime events
- Production-ready gateway with rate limiting and SSE proxying

## Architecture Summary

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart LR
  subgraph Browser
    UI[Browser SOC UI]
    SPA[React SPA + React Flow]
    UI --> SPA
  end

  subgraph Edge
    GW[Nginx Gateway]
  end

  subgraph Backend
    API[FastAPI Backend]
    RBAC[RBAC + Tenant Guards]
    SSE[Stream Endpoints]
    API --> RBAC
    API --> SSE
  end

  subgraph Data
    PG[(PostgreSQL)]
    REDIS[(Redis)]
  end

  subgraph Async
    WORKER[Celery Worker]
  end

  subgraph ML
    MLSVC[ML Service]
  end

  SPA -->|HTTPS /api| GW --> API
  SPA -->|EventSource /api/v1/stream| GW --> SSE
  API --> PG
  API --> REDIS
  API -->|/infer| MLSVC
  WORKER --> REDIS
  WORKER -->|/retrain| MLSVC
  WORKER --> PG
```

---

## Request Lifecycle (High-Level)

1. Browser initializes auth bootstrap and tenant scope.
2. Gateway proxies API and SSE requests.
3. Backend enforces RBAC and tenant scoping.
4. Telemetry and topology updates persist to Postgres.
5. SSE streams emit periodic snapshots to the UI.

### Backend Stack

- FastAPI + SQLAlchemy 2.x
- Alembic migrations
- PostgreSQL (primary datastore)
- Redis (Celery broker/result backend)
- Celery (retrain jobs)
- Prometheus client metrics endpoint
- SlowAPI rate limiting

### Frontend Stack

- React 18 + Vite
- React Router
- Tailwind CSS
- React Flow for topology rendering
- EventSource (SSE) for live streams

## Security Model

- Auth uses HttpOnly cookies (JWT) with CSRF double-submit protection.
- Permission checks enforced on the backend via dependency guards.
- Role permissions are resolved from DB roles plus a safe fallback map.
- Admins bypass permission checks but still remain tenant-aware when requested.
- Gateway blocks direct access to ML service routes.

---

## Authentication and Session Bootstrap

```mermaid
%%{init: {'theme': 'dark'}}%%
sequenceDiagram
  autonumber
  participant Browser
  participant API as FastAPI

  Browser->>API: POST /api/v1/auth/register
  API-->>Browser: User created, sends verification email
  Browser->>API: POST /api/v1/auth/verify-email
  API-->>Browser: Email verified (Customers await Admin approval, Analysts auto-approved)
  
  Browser->>API: GET /api/v1/auth/csrf
  API-->>Browser: Set ics_csrf_token cookie + token body
  Browser->>API: POST /api/v1/auth/login (X-CSRF-Token)
  API-->>Browser: Set ics_access_token HttpOnly cookie
  Browser->>API: GET /api/v1/auth/me
  API-->>Browser: user + permissions
  Browser->>API: GET /api/v1/users/{id}/customers (analyst/viewer)
  API-->>Browser: assigned customer tenants
  Note over Browser,API: AuthContext refreshes /auth/me on background refresh
  Note over Browser: If refresh fails, UI shows recovery screen
```

## Multi-Tenant RBAC Model

- Users have a primary `users.role` (admin/customer/analyst/viewer).
- Additional role assignments exist via `user_roles` for flexible RBAC.
- Analyst/Viewer users are scoped to customer tenants via assignments.
- Customer users can only access their own tenant data.

See docs:

- docs/RBAC.md
- docs/MULTI_TENANCY.md

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart TB
  Admin[Admin] -->|Global access| AllTenants[All tenants]
  Admin -->|Tenant filter| TenantScoped[Single tenant]
  Customer[Customer] -->|Self-scope| OwnTenant[Own tenant]
  Analyst[Analyst] -->|Assigned customers| Assigned[Assigned tenant list]
  Viewer[Viewer] -->|Assigned customers| Assigned
```

## Live Telemetry + Topology

Telemetry ingestion:

- `POST /api/v1/traffic/ingest`
- `POST /api/v1/traffic/{id}/detect`

Topology is built from:

- Observed traffic (`topology_edges` with source=traffic_observed)
- Device metadata relationships
- Manual edge creation

See docs:

- docs/TOPOLOGY.md

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart LR
  Ingest[POST /traffic/ingest] --> Record[(traffic_records)]
  Record --> TopoSync[sync_edge_from_traffic_record]
  TopoSync --> Edges[(topology_edges)]
  Record --> DeviceLink[Device state + last_traffic_at]
  DeviceLink --> Devices[(devices)]
```

## SSE Architecture

Endpoints:

- `GET /api/v1/stream/alerts` (event: `snapshot`)
- `GET /api/v1/stream/topology` (event: `topology_batch`)

Streams are tenant-scoped, authenticated via cookies, and proxied by the gateway with buffering disabled.

See docs:

- docs/SSE_STREAMS.md

```mermaid
%%{init: {'theme': 'dark'}}%%
sequenceDiagram
  autonumber
  participant Browser
  participant GW as Nginx
  participant API as FastAPI
  participant DB as Postgres

  Browser->>GW: EventSource /api/v1/stream/alerts
  GW->>API: Proxy stream (no buffering)
  loop every SSE_INTERVAL_SECONDS
    API->>DB: Snapshot queries (alerts, dashboard, models)
    API-->>Browser: event: snapshot
  end
  Note over Browser: Client backoff + reconnect on error
```

## ML Pipeline Overview

- Backend sends normalized telemetry to the ML service `/infer` endpoint.
- ML service responds with risk score, status, confidence, and alert metadata.
- Detection results update `traffic_records`, `alerts`, and device state.
- Retraining runs via Celery (`/api/v1/model/retrain`).

---

## Detection Pipeline

```mermaid
%%{init: {'theme': 'dark'}}%%
sequenceDiagram
  autonumber
  participant UI
  participant API
  participant DB
  participant ML
  participant SSE

  UI->>API: POST /api/v1/traffic/ingest
  API->>DB: Insert traffic_records
  API->>DB: Update devices + topology_edges
  UI->>API: POST /api/v1/traffic/{id}/detect
  API->>ML: POST /infer (X-ML-Internal-Key)
  ML-->>API: Verdict (risk, status, confidence)
  API->>DB: Update traffic_records + alerts + device state
  SSE-->>UI: Next snapshot includes new alerts/topology
```

## Folder Structure

```
backend/       FastAPI app, SQLAlchemy models, Alembic
frontend/      React SPA, topology components, SSE client
gateway/       Nginx configs (dev/prod)
ml-service/    Internal ML inference service
scripts/       Dev/prod helpers
```

## Local Development Setup

Windows quick start:

```bat
ICS.bat
```

PowerShell:

```powershell
./scripts/start-dev.ps1
```

The dev script:

- Creates missing .env files
- Starts Docker Desktop (if possible)
- Runs Alembic migrations
- Waits for gateway health checks

## Docker Setup

- Base compose: docker-compose.yml
- Dev overrides: docker-compose.dev.yml
- Prod overrides: docker-compose.prod.yml

Dev:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Prod:

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Environment Variables (Core)

Backend:

- `DATABASE_URL`
- `REDIS_URL`
- `ML_SERVICE_URL`
- `ML_SERVICE_API_KEY`
- `JWT_SECRET_KEY`
- `AUTH_COOKIE_SECURE`
- `AUTH_COOKIE_SAMESITE`
- `SSE_MAX_CONNECTIONS`
- `SSE_MAX_CONNECTION_SECONDS`
- `DEVICE_OFFLINE_AFTER_MINUTES`
- `BOOTSTRAP_ADMIN_ENABLED`
- `PUBLIC_LIVE_SNAPSHOT_ENABLED`

Frontend:

- `VITE_API_BASE_URL`

Gateway:

- `GATEWAY_PORT`
- `GATEWAY_HTTPS_PORT`
- `TLS_CERT_PATH`
- `TLS_KEY_PATH`

See backend/.env.example and ml-service/.env.example for complete lists.

## Running Migrations

The backend container runs `alembic upgrade head` on startup unless `SKIP_ALEMBIC=1` is set.

Manual:

```powershell
cd backend
alembic upgrade head
```

## Default Roles

- **Admin**: Full permissions; can access all tenants or target a specific tenant.
- **Customer**: Own-tenant visibility and operational permissions (ingest, detect, devices).
- **Analyst**: Assigned-customer visibility with alert/traffic workflows.
- **Viewer**: Assigned-customer read-only visibility.

## Screenshots (Placeholders)

- `docs/screenshots/dashboard.png`
- `docs/screenshots/topology.png`
- `docs/screenshots/rbac.png`

## API Overview

Auth:

- `/api/v1/auth/register`, `/login`, `/logout`, `/me`, `/csrf`

RBAC:

- `/api/v1/rbac/roles`, `/api/v1/rbac/permissions`, `/api/v1/users/*/roles`

Tenancy:

- `/api/v1/users/{id}/customers`, `/api/v1/users/assignments/bulk`

Telemetry + Detection:

- `/api/v1/traffic/ingest`, `/api/v1/traffic/{id}/detect`

Topology:

- `/api/v1/topology/snapshot`, `/api/v1/topology/edges`

Streams:

- `/api/v1/stream/alerts`, `/api/v1/stream/topology`

Models:

- `/api/v1/model/versions`, `/api/v1/model/retrain`, `/api/v1/model/soc-health`

## Troubleshooting

- SSE disconnects: check gateway buffering settings and SSE limits in backend config.
- Login succeeds but POST fails (403): refresh `/api/v1/auth/csrf` and retry with `X-CSRF-Token`.
- Topology empty: verify device inventory exists and telemetry ingestion is occurring.
- No tenant data for analyst/viewer: confirm customer assignments exist.
- Packet capture failing: Scapy must be installed and host must allow capture privileges.
- Migrations failing on startup: set `SKIP_ALEMBIC=1`, run Alembic manually, then restart.

## Known Limitations

- Topology retention does not include automatic cleanup beyond offline marking.
- SSE streams are polling snapshots (not delta events).
- Packet capture is host-privilege dependent and may be disabled in containers.
- Tenant assignments for analyst/viewer are required before access.

## Future Roadmap

- Zone grouping and MITRE overlays in topology UI
- Attack-path propagation and richer edge analytics
- Dedicated telemetry streaming pipeline (Kafka/MQTT)
- Enhanced protocol parsers for Modbus/DNP3/IEC104

## Docs

- docs/ARCHITECTURE.md
- docs/RBAC.md
- docs/TOPOLOGY.md
- docs/SSE_STREAMS.md
- docs/MULTI_TENANCY.md
