from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class IncidentStatus(str, Enum):
    open = "open"
    triaged = "triaged"
    resolved = "resolved"


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    owner: Mapped[str] = mapped_column(String(64), nullable=False, default="unassigned")
    status: Mapped[IncidentStatus] = mapped_column(SqlEnum(IncidentStatus), nullable=False, default=IncidentStatus.open)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
