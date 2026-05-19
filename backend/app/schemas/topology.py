from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class TopologyRelationshipTypeSchema(str, Enum):
    connected_to = "connected_to"
    upstream = "upstream"
    downstream = "downstream"
    peer = "peer"
    parent = "parent"


class TopologyEdgeDirectionSchema(str, Enum):
    forward = "forward"
    reverse = "reverse"
    bidirectional = "bidirectional"


class TopologyEdgeCreate(BaseModel):
    source_device_id: int
    target_device_id: int
    relationship_type: TopologyRelationshipTypeSchema = TopologyRelationshipTypeSchema.connected_to
    direction: TopologyEdgeDirectionSchema = TopologyEdgeDirectionSchema.bidirectional
    protocol_context: str | None = Field(default=None, max_length=64)
    metadata_json: dict = Field(default_factory=dict)


class TopologyEdgeResponse(BaseModel):
    id: int
    source_device_id: int
    target_device_id: int
    source_name: str | None = None
    target_name: str | None = None
    relationship_type: str
    direction: str
    protocol_context: str | None = None
    metadata_json: dict = Field(default_factory=dict)
    packet_count: int = 0
    bytes_total: int = 0
    is_active: bool = True
    edge_source: str
    first_seen_at: datetime | None = None
    last_seen_at: datetime | None = None

    class Config:
        from_attributes = True


class TopologyNodeSnapshot(BaseModel):
    device_id: int
    name: str
    ip_address: str | None = None
    device_type: str | None = None
    operational_state: str
    monitoring_status: str
    last_traffic_at: datetime | None = None
    last_ml_risk_score: float | None = None
    last_ml_status: str | None = None
    metadata_json: dict = Field(default_factory=dict)
    is_active: bool = True


class TopologyEdgeActivity(BaseModel):
    edge_id: int
    active: bool
    packet_count: int
    last_seen_at: datetime | None = None


class TopologySnapshotResponse(BaseModel):
    timestamp: str
    nodes: list[TopologyNodeSnapshot]
    edges: list[TopologyEdgeResponse]
    edge_activity: list[TopologyEdgeActivity]


class TopologyBackfillResponse(BaseModel):
    traffic_edges_upserted: int
