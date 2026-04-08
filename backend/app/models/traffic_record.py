from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TrafficRecord(Base):
    __tablename__ = "traffic_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source_ip: Mapped[str] = mapped_column(String(64), nullable=False)
    destination_ip: Mapped[str] = mapped_column(String(64), nullable=False)
    source_port: Mapped[int] = mapped_column(Integer, nullable=False)
    destination_port: Mapped[int] = mapped_column(Integer, nullable=False)
    transport_protocol: Mapped[str] = mapped_column(String(16), nullable=False)

    packet_count: Mapped[int] = mapped_column(Integer, nullable=False)
    bytes_in: Mapped[int] = mapped_column(Integer, nullable=False)
    bytes_out: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_ms: Mapped[float] = mapped_column(Float, nullable=False)
    payload_entropy: Mapped[float] = mapped_column(Float, nullable=False)

    modbus_function_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    modbus_unit_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dnp3_function_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    iec104_type_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    ingestion_source: Mapped[str] = mapped_column(String(32), nullable=False, default="json")
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default={})

    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    attack_class: Mapped[str | None] = mapped_column(String(64), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    explanation_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    model_version_id: Mapped[int | None] = mapped_column(ForeignKey("model_versions.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
