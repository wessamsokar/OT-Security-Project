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
    hour: str
    packets: int
    dominant_protocol: str


class PacketsByHourResponse(BaseModel):
    today_total: int
    avg_per_minute: int
    peak_hour: str
    rows: list[PacketsByHourRow]
