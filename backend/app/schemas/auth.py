import re
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.user import IndustryType, UserRole


# ---------------------------------------------------------------------------
# Shared regex patterns
# ---------------------------------------------------------------------------
_FULL_NAME_RE = re.compile(r"^[A-Za-zÀ-ÖØ-öø-ÿ\s'\-]+$")
_COMPANY_NAME_RE = re.compile(r"^[A-Za-z0-9\s&,.\-']+$")
_JOB_TITLE_RE = re.compile(r"^[A-Za-z0-9\s/,.\-]+$")


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    """Self-service OT organization onboarding (stored; admin must approve)."""
    full_name: str = Field(min_length=3, max_length=50)
    company_name: str = Field(min_length=2, max_length=180)
    email: EmailStr
    job_title: str = Field(min_length=2, max_length=120)
    industry_type: str = Field(min_length=2, max_length=64)
    infrastructure_type: str = Field(min_length=2, max_length=180)
    estimated_device_count: int = Field(ge=1, le=10_000_000)
    country: str = Field(min_length=2, max_length=80)
    purpose_of_access: str = Field(min_length=20, max_length=4000)
    # Soft-removed: field is no longer required on the registration form.
    # Kept optional so existing clients that still send it do not break.
    operates_ot_ics: Optional[bool] = None
    password: str = Field(min_length=8, max_length=128)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 5:
            raise ValueError(
                "Full name must be at least 5 characters (first and last name required)."
            )
        words = [w for w in v.split() if w]
        if len(words) < 2:
            raise ValueError(
                "Please enter your first and last name."
            )
        if not _FULL_NAME_RE.match(v):
            raise ValueError(
                "Full name may only contain letters, spaces, hyphens, and apostrophes."
            )
        return v

    @field_validator("company_name")
    @classmethod
    def validate_company_name(cls, v: str) -> str:
        v = v.strip()
        if not _COMPANY_NAME_RE.match(v):
            raise ValueError(
                "Company name may only contain letters, numbers, spaces, and & - , . ' characters."
            )
        if not re.search(r"[A-Za-z]", v):
            raise ValueError(
                "Company name must contain at least one letter."
            )
        return v

    @field_validator("job_title")
    @classmethod
    def validate_job_title(cls, v: str) -> str:
        v = v.strip()
        if not _JOB_TITLE_RE.match(v):
            raise ValueError(
                "Job title may only contain letters, numbers, spaces, and / , . - characters."
            )
        if v.isdigit():
            raise ValueError(
                "Job title must not consist of numbers only."
            )
        return v

    @field_validator("infrastructure_type")
    @classmethod
    def validate_infrastructure_type(cls, v: str) -> str:
        return v.strip()


class UserProfileUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=3, max_length=50)
    email_alerts_enabled: bool | None = None
    default_landing_page: str | None = Field(None, max_length=32)


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    is_email_verified: bool
    is_admin_approved: bool
    onboarding_status: str
    permissions: list[str] = []
    company_name: str | None = None
    job_title: str | None = None
    industry_type: str | None = None
    infrastructure_type: str | None = None
    estimated_device_count: int | None = None
    country: str | None = None
    
    email_alerts_enabled: bool
    default_landing_page: str

    class Config:
        from_attributes = True


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class RequestEmailVerificationRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10, max_length=256)
    new_password: str = Field(min_length=8, max_length=128)


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=10, max_length=256)


class MessageResponse(BaseModel):
    message: str
    token: str | None = None


class CsrfResponse(BaseModel):
    csrf_token: str
