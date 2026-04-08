from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AlertSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class AlertStatus(str, Enum):
    new = "new"
    investigating = "investigating"
    closed = "closed"


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    traffic_record_id: Mapped[int] = mapped_column(ForeignKey("traffic_records.id"), nullable=False)
    severity: Mapped[AlertSeverity] = mapped_column(SqlEnum(AlertSeverity), nullable=False)
    status: Mapped[AlertStatus] = mapped_column(SqlEnum(AlertStatus), nullable=False, default=AlertStatus.new)
    summary: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
