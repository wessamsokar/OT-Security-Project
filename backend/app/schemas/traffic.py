"""
Traffic-related Pydantic schemas.

Metric naming conventions used throughout this file
-----------------------------------------------------
  packet_count  : SUM of TrafficRecord.packet_count — actual network packets.
                  One flow record may represent many packets (e.g. 1 Modbus
                  request + 1 response = 2 packets in a single flow record).

  flow_count    : COUNT of TrafficRecord rows — one per ingested network flow.
                  This is what the ML pipeline evaluates and alerts attach to.
                  "Flow" is the correct term; "traffic record" is the DB row term.

  alert_count   : COUNT of Alert rows. One flow may produce 0 or 1 alerts.

  today_total   : DEPRECATED alias for packet_count_total. Kept for backward
                  compatibility. Remove after all consumers are updated.
"""

from datetime import datetime

from pydantic import BaseModel, Field, IPvAnyAddress, field_validator


class ICSTrafficIn(BaseModel):
    source_ip: IPvAnyAddress
    destination_ip: IPvAnyAddress
    source_port: int = Field(ge=1, le=65535)
    destination_port: int = Field(ge=1, le=65535)
    transport_protocol: str

    packet_count: int = Field(ge=1)
    bytes_in: int = Field(ge=0)
    bytes_out: int = Field(ge=0)
    duration_ms: float = Field(ge=0)
    payload_entropy: float = Field(ge=0, le=8)

    modbus_function_code: int | None = Field(default=None, ge=0, le=255)
    modbus_unit_id: int | None = Field(default=None, ge=0, le=255)
    dnp3_function_code: int | None = Field(default=None, ge=0, le=255)
    iec104_type_id: int | None = Field(default=None, ge=0, le=255)

    ingestion_source: str = Field(default="json", pattern="^(json|pcap)$")
    metadata_json: dict = Field(default_factory=dict)

    @field_validator("transport_protocol", mode="before")
    @classmethod
    def normalize_transport_protocol(cls, v: object) -> str:
        """Match ml-service InferRequest: lowercase tcp | udp | icmp (frontend may send TCP)."""
        if not isinstance(v, str):
            raise ValueError("transport_protocol must be a string")
        s = v.lower().strip()
        if s not in ("tcp", "udp", "icmp"):
            raise ValueError("transport_protocol must be one of: tcp, udp, icmp")
        return s


class DetectionResponse(BaseModel):
    record_id: int
    risk_score: float | None
    ml_status: str
    alert_severity: str
    attack_detected: bool
    device_id: int | None = None
    attack_class: str
    confidence: float
    explanation: dict
    model_version: str | None


class TrafficRecordResponse(BaseModel):
    id: int
    source_ip: str
    destination_ip: str
    transport_protocol: str
    device_id: int | None = None
    ml_status: str | None = None
    ml_alert_severity: str | None = None
    ml_attack_detected: bool | None = None
    risk_score: float | None
    attack_class: str | None
    confidence: float | None
    created_at: datetime

    class Config:
        from_attributes = True


class PacketsByHourRow(BaseModel):
    """
    Per-hour breakdown of traffic volume.

    Fields
    ------
    hour              : UTC hour label "HH:00"
    packets           : SUM of TrafficRecord.packet_count — actual network packets
    flow_count        : COUNT of TrafficRecord rows — telemetry records / flows ingested
    dominant_protocol : Transport protocol with the highest packet volume this hour
    """

    hour: str
    packets: int             # network packet count (SUM of packet_count)
    flow_count: int = 0      # telemetry flow records (COUNT of rows)
    dominant_protocol: str


class PacketsByHourResponse(BaseModel):
    """
    24-hour traffic telemetry summary.

    Packet vs flow distinction
    --------------------------
    packet_count_total : Total network packets in the last 24h.
                         = SUM(TrafficRecord.packet_count) over 24h.
                         Use this for network volume analysis.

    flow_count_total   : Total flow records (telemetry rows) in the last 24h.
                         = COUNT(TrafficRecord.id) over 24h.
                         Use this for operational load and ingestion rate analysis.

    today_total        : DEPRECATED alias for packet_count_total.
                         Kept for backward compatibility. Do not use in new code.

    avg_per_minute     : packet_count_total / actual_elapsed_minutes.
                         Uses real elapsed time — NOT hardcoded 24*60.
    """

    # Authoritative packet total (network packets, SUM)
    packet_count_total: int

    # Total flow records (telemetry rows, COUNT)
    flow_count_total: int = 0

    # DEPRECATED: alias for packet_count_total — kept for backward compatibility
    # TODO: remove after all frontend consumers are updated to use packet_count_total
    today_total: int = 0

    avg_per_minute: int
    peak_hour: str
    rows: list[PacketsByHourRow]


class InventoryEdgeResponse(BaseModel):
    """Aggregated flows between two inventory devices (IP-correlated), not inferred topology."""

    device_a_id: int
    device_b_id: int
    packet_count: int


class ProtocolDistributionRow(BaseModel):
    """
    Per-protocol packet distribution.
    packets = SUM of TrafficRecord.packet_count for flows using this protocol.
    This is a network packet count, NOT a flow count or row count.
    """

    protocol: str
    packets: int    # network packet count (SUM), not flow count
    last_seen_at: datetime | None = None


class ProtocolDistributionResponse(BaseModel):
    """
    Protocol visibility summary.
    total_packets = SUM of all network packets across all protocols in the window.
    This is NOT a flow count or row count.
    """

    window_hours: int
    total_packets: int  # SUM of network packets (not flow records)
    protocols: list[ProtocolDistributionRow]


class TelemetryHealthResponse(BaseModel):
    """
    Rolling-window telemetry health metrics.

    Packet metrics — SUM of TrafficRecord.packet_count (actual network packets):
      packets_last_minute  — network packets received in the last 1 minute
      packets_last_5min    — network packets received in the last 5 minutes
      packets_last_15min   — network packets received in the last 15 minutes

    Flow metrics — COUNT of TrafficRecord rows (ingested telemetry records):
      flow_count_last_minute — flow records ingested in the last 1 minute
      flow_count_last_5min   — flow records ingested in the last 5 minutes
      flow_count_last_15min  — flow records ingested in the last 15 minutes

    Rate metrics:
      avg_packets_per_minute_15m — packet_count_15min / 15 (rolling, not 24*60)
    """

    window_minutes: int

    # Packet metrics (SUM of actual network packets per time window)
    packets_last_minute: int
    packets_last_5min: int
    packets_last_15min: int
    avg_packets_per_minute_15m: float

    # Flow metrics (COUNT of telemetry flow records per time window)
    flow_count_last_minute: int = 0
    flow_count_last_5min: int = 0
    flow_count_last_15min: int = 0

    last_traffic_at: datetime | None = None
    dropped_packets: int | None = None
