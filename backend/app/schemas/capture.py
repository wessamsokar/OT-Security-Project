from pydantic import BaseModel, Field


class PacketCaptureRequest(BaseModel):
    interface: str | None = Field(default=None, max_length=64)
    duration_seconds: int = Field(default=10, ge=1, le=3600)
    packet_count: int | None = Field(default=None, ge=1, le=100000)
    bpf_filter: str | None = Field(default=None, max_length=256)
    output_filename: str | None = Field(default=None, max_length=128)


class PacketCaptureResponse(BaseModel):
    capture_id: str
    status: str
    file_path: str


class PacketCaptureStopRequest(BaseModel):
    capture_id: str = Field(min_length=8, max_length=128)


class PacketCaptureStatusResponse(BaseModel):
    capture_id: str
    status: str
