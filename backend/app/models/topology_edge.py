from datetime import datetime
from enum import Enum

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TopologyRelationshipType(str, Enum):
    connected_to = "connected_to"
    upstream = "upstream"
    downstream = "downstream"
    peer = "peer"
    parent = "parent"


class TopologyEdgeDirection(str, Enum):
    forward = "forward"
    reverse = "reverse"
    bidirectional = "bidirectional"


class TopologyEdgeSource(str, Enum):
    traffic_observed = "traffic_observed"
    metadata_declared = "metadata_declared"
    manual = "manual"


class TopologyEdge(Base):
    __tablename__ = "topology_edges"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "source_device_id",
            "target_device_id",
            "relationship_type",
            name="uq_topology_edge_relationship",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    source_device_id: Mapped[int] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"), index=True, nullable=False
    )
    target_device_id: Mapped[int] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"), index=True, nullable=False
    )
    relationship_type: Mapped[str] = mapped_column(String(32), nullable=False, default=TopologyRelationshipType.connected_to.value)
    direction: Mapped[str] = mapped_column(String(24), nullable=False, default=TopologyEdgeDirection.bidirectional.value)
    protocol_context: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    packet_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bytes_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    edge_source: Mapped[str] = mapped_column(String(32), nullable=False, default=TopologyEdgeSource.traffic_observed.value)
    first_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    source_device = relationship("Device", foreign_keys=[source_device_id])
    target_device = relationship("Device", foreign_keys=[target_device_id])
