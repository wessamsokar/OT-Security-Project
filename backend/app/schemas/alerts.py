from datetime import datetime

from pydantic import BaseModel

from app.models.alert import AlertSeverity, AlertStatus


class AlertResponse(BaseModel):
    id: int
    traffic_record_id: int
    severity: AlertSeverity
    status: AlertStatus
    summary: str
    created_at: datetime

    class Config:
        from_attributes = True


class DashboardSummary(BaseModel):
    total_records: int
    total_alerts: int
    incidents_open: int
    avg_risk_score: float
    class_distribution: dict[str, int]
