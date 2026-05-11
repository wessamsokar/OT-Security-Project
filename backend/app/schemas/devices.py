from datetime import datetime

from pydantic import BaseModel, Field, IPvAnyAddress


class DeviceBase(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    device_type: str | None = Field(default=None, max_length=64)
    ip_address: IPvAnyAddress | None = None
    serial_number: str | None = Field(default=None, max_length=128)
    location: str | None = Field(default=None, max_length=128)
    metadata_json: dict = Field(default_factory=dict)
    is_active: bool = True


class DeviceCreate(DeviceBase):
    pass


class DeviceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=128)
    device_type: str | None = Field(default=None, max_length=64)
    ip_address: IPvAnyAddress | None = None
    serial_number: str | None = Field(default=None, max_length=128)
    location: str | None = Field(default=None, max_length=128)
    metadata_json: dict | None = None
    is_active: bool | None = None


class DeviceResponse(DeviceBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    last_ml_risk_score: float | None = None
    last_ml_status: str | None = None
    monitoring_status: str = "offline"
    last_traffic_at: datetime | None = None
    last_seen_traffic_id: int | None = None

    class Config:
        from_attributes = True


class ReconcileTrafficResponse(BaseModel):
    """POST /devices/{id}/reconcile-traffic"""

    linked_records: int


class OfflineSweepResponse(BaseModel):
    devices_marked_offline: int
