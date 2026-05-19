from datetime import datetime

from pydantic import BaseModel
from pydantic import Field


class AuditLogResponse(BaseModel):
    id: int
    created_at: datetime
    actor_user_id: int | None
    actor_email: str | None
    action: str
    category: str
    resource_type: str | None
    resource_id: str | None
    ip_address: str | None
    success: bool
    detail: str | None

    class Config:
        from_attributes = True


class ClientSecurityEvent(BaseModel):
    action: str = Field(pattern="^(tamper\\.detected|devtools\\.detected|runtime\\.integrity\\.failure)$")
    severity: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    score: int = Field(default=0, ge=0, le=100)
    reason: str = Field(min_length=1, max_length=240)
    signals: list[str] = Field(default_factory=list, max_length=25)
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class CspViolationReport(BaseModel):
    # Browser reports use either "csp-report" or "body" depending on Reporting API version.
    csp_report: dict | None = Field(default=None, alias="csp-report")
    body: dict | None = None

    class Config:
        populate_by_name = True
