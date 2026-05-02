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

    class Config:
        from_attributes = True
