from datetime import datetime

from pydantic import BaseModel, Field

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
    ml_status_distribution: dict[str, int] = Field(default_factory=dict)


class ActiveThreatResponse(BaseModel):
    threat_id: str
    attack_vector: str
    target_asset: str
    risk: str
    created_at: datetime


class MttrIncidentResponse(BaseModel):
    incident_id: str
    opened_at: datetime
    resolved_at: datetime | None
    status: str
    mttr_minutes: int


class MttrSummaryResponse(BaseModel):
    average_mttr_minutes: int
    target_sla_minutes: int
    incidents: list[MttrIncidentResponse]


class PublicLiveSnapshotResponse(BaseModel):
    dashboard: DashboardSummary
    active_threats: list[ActiveThreatResponse]
    updated_at: datetime
