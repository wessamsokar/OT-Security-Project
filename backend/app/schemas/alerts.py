from datetime import datetime

from pydantic import BaseModel, Field

from app.models.alert import AlertSeverity, AlertStatus


class AlertResponse(BaseModel):
    id: int
    traffic_record_id: int
    tenant_name: str | None = None
    severity: AlertSeverity
    status: AlertStatus
    summary: str
    created_at: datetime

    class Config:
        from_attributes = True


class DashboardSummary(BaseModel):
    """
    Top-level dashboard aggregates.

    Metric separation
    -----------------
    total_records        : ALL-TIME count of TrafficRecord rows (historical visibility).
                           Use this to show "total telemetry records ever ingested".

    flows_last_24h       : COUNT of TrafficRecord rows in the last 24 hours (operational).
                           Use this for live operational dashboards and trend monitoring.
                           Matches the window used by soc-health traffic_flows_in_window.

    total_packet_count_24h : SUM of TrafficRecord.packet_count in the last 24 hours.
                             Use this for actual network packet volume analysis.
                             Higher than flows_last_24h when flows carry many packets.

    total_alerts         : COUNT of all Alert rows (linked to any traffic record, all time).

    incidents_open       : COUNT of unresolved Incident rows.
    """

    total_records: int                     # All-time telemetry row count (historical)
    flows_last_24h: int = 0                # 24h windowed flow record count (operational)
    total_packet_count_24h: int = 0        # 24h windowed network packet total

    total_alerts: int                      # All-time alert count
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
