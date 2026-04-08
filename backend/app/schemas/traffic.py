from datetime import datetime

from pydantic import BaseModel, Field, IPvAnyAddress


class ICSTrafficIn(BaseModel):
    source_ip: IPvAnyAddress
    destination_ip: IPvAnyAddress
    source_port: int = Field(ge=1, le=65535)
    destination_port: int = Field(ge=1, le=65535)
    transport_protocol: str = Field(pattern="^(tcp|udp|icmp)$")

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


class DetectionResponse(BaseModel):
    record_id: int
    risk_score: float
    attack_class: str
    confidence: float
    explanation: dict
    model_version: str | None


class TrafficRecordResponse(BaseModel):
    id: int
    source_ip: str
    destination_ip: str
    transport_protocol: str
    risk_score: float | None
    attack_class: str | None
    confidence: float | None
    created_at: datetime

    class Config:
        from_attributes = True
