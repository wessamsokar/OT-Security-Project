# Topology

Topology is a persisted graph of device relationships derived from telemetry, metadata, and manual edits. It powers both the REST snapshot and the SSE topology stream.

---

## Topology Data Model

```mermaid
%%{init: {'theme': 'dark'}}%%
erDiagram
	USERS ||--o{ DEVICES : owns
	USERS ||--o{ TOPOLOGY_EDGES : scopes
	DEVICES ||--o{ TOPOLOGY_EDGES : source
	DEVICES ||--o{ TOPOLOGY_EDGES : target
	USERS ||--o{ TRAFFIC_RECORDS : owns
	DEVICES ||--o{ TRAFFIC_RECORDS : links

	TOPOLOGY_EDGES {
		int id
		int user_id
		int source_device_id
		int target_device_id
		string relationship_type
		string direction
		string protocol_context
		int packet_count
		int bytes_total
		bool is_active
		string edge_source
		datetime first_seen_at
		datetime last_seen_at
	}
```

## Data Model

`topology_edges` fields include:

- `user_id`, `source_device_id`, `target_device_id`
- `relationship_type` (connected_to, upstream, downstream, peer, parent)
- `direction` (forward, reverse, bidirectional)
- `protocol_context` (modbus, dnp3, iec104, tcp, udp, icmp)
- `packet_count`, `bytes_total`
- `first_seen_at`, `last_seen_at`
- `edge_source` (traffic_observed, metadata_declared, manual)
- `is_active`

Edges are unique per `(user_id, source_device_id, target_device_id, relationship_type)`.

## Edge Sources

- traffic_observed: created from telemetry flows when both endpoints map to devices.
- metadata_declared: created from device metadata fields (connected, parent, peer).
- manual: created via `/topology/edges` API.

## Snapshot Endpoints

- `GET /api/v1/topology/snapshot`
- `GET /api/v1/topology/edges`
- `GET /api/v1/topology/edges/device/{id}`
- `POST /api/v1/topology/edges`
- `POST /api/v1/topology/backfill-traffic`
- `POST /api/v1/topology/sync-metadata`

## Operational State

Device operational state is derived server-side from:

- `last_traffic_at` (staleness threshold)
- `monitoring_status` (under_attack, suspicious, active, offline)
- `metadata_json.packet_capture_enabled`

Priority order:

1. inactive
2. anomalous
3. degraded
4. offline (stale)
5. online
6. unknown

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart TD
	Start[Device status input] --> Inactive{is_active?}
	Inactive -->|false| StateInactive[inactive]
	Inactive -->|true| Attack{monitoring_status}
	Attack -->|under_attack| StateAnom[anomalous]
	Attack -->|suspicious| StateDegraded[degraded]
	Attack -->|active/other| Traffic{last_traffic_at stale?}
	Traffic -->|stale| StateOffline[offline]
	Traffic -->|fresh| Online{packet_capture_enabled?}
	Online -->|true| StateCapture[capture_enabled]
	Online -->|false| StateOnline[online]
```

---

## Live Topology Sync

```mermaid
%%{init: {'theme': 'dark'}}%%
sequenceDiagram
	autonumber
	participant Ingest as /traffic/ingest
	participant Topo as topology service
	participant DB as Postgres
	participant Stream as /stream/topology
	participant UI as React Flow

	Ingest->>DB: Insert traffic_records
	Ingest->>Topo: sync_edge_from_traffic_record
	Topo->>DB: Upsert topology_edges
	Stream->>DB: build_topology_snapshot
	Stream-->>UI: topology_batch
```

## Live Topology SSE

- `GET /api/v1/stream/topology`
- Event name: `topology_batch`
- Payload includes nodes, edges, edge_activity, and a sequence counter

## Frontend Rendering

- React Flow renders nodes and edges with custom components.
- Nodes are arranged in a grid layout with status-based styling.
- Edges animate when active traffic is present.
- MiniMap colors reflect operational state (online, degraded, anomalous, offline).

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart LR
	Snapshot[TopologySnapshot] --> Adapter[topologyAdapter]
	Adapter --> Nodes[React Flow Nodes]
	Adapter --> Edges[React Flow Edges]
	Edges --> Anim[Animated edge activity]
	Nodes --> Styles[Status-based node styles]
```
