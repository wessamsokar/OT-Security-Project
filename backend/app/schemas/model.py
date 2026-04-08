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
