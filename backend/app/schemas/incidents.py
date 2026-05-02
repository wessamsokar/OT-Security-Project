from datetime import datetime

from pydantic import BaseModel

from app.models.incident import IncidentStatus


class IncidentResponse(BaseModel):
    id: int
    alert_id: int
    title: str
    owner: str
    status: IncidentStatus
    created_at: datetime

    class Config:
        from_attributes = True
