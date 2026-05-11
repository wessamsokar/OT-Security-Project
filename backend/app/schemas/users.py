from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.customer
    is_active: bool = True
    is_email_verified: bool = False
    # Admin-created accounts are approved by default so they can sign in immediately.
    is_admin_approved: bool = True


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=50)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role: UserRole | None = None
    is_active: bool | None = None
    is_email_verified: bool | None = None
    is_admin_approved: bool | None = None


class UserAdminResponse(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    is_active: bool
    is_email_verified: bool
    email_verified_at: datetime | None = None
    is_admin_approved: bool
    admin_approved_at: datetime | None = None
    onboarding_status: str
    rejected_at: datetime | None = None
    company_name: str | None = None
    job_title: str | None = None
    industry_type: str | None = None
    infrastructure_type: str | None = None
    estimated_device_count: int | None = None
    country: str | None = None
    purpose_of_access: str | None = None
    operates_ot_ics: bool | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class OnboardingRejectRequest(BaseModel):
    """Optional context for rejection email (stored only in audit log future)."""
    reason: str | None = Field(default=None, max_length=2000)
