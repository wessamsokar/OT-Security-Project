from datetime import datetime

from pydantic import BaseModel


class RetrainResponse(BaseModel):
    task_id: str
    status: str


class ModelVersionResponse(BaseModel):
    id: int
    version: str
    label: str
    metrics_json: dict
    trained_by: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SecurityPostureResponse(BaseModel):
    system_uptime: str
    blocked_ips_today: int
    failed_logins: int
    model_drift: str
    incidents_open: int


class SocHealthResponse(BaseModel):
    """Aggregates for SOC health UI: DB / ML fields only (rolling window)."""

    window_hours: int = 24
    traffic_flows_in_window: int
    ml_status_counts: dict[str, int]
    traffic_attack_detected_count: int
    alerts_severity_counts: dict[str, int]
    devices_registered: int
    monitoring_status_counts: dict[str, int]
    avg_last_ml_risk_score: float | None = None
