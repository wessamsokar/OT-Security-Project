from pydantic import BaseModel, EmailStr, Field

from app.models.user import IndustryType, UserRole


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    """Self-service OT organization onboarding (stored; admin must approve)."""
    full_name: str = Field(min_length=3, max_length=50)
    company_name: str = Field(min_length=2, max_length=180)
    email: EmailStr
    job_title: str = Field(min_length=2, max_length=120)
    industry_type: IndustryType
    infrastructure_type: str = Field(min_length=2, max_length=180)
    estimated_device_count: int = Field(ge=1, le=10_000_000)
    country: str = Field(min_length=2, max_length=80)
    purpose_of_access: str = Field(min_length=20, max_length=4000)
    operates_ot_ics: bool
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    is_email_verified: bool
    is_admin_approved: bool
    onboarding_status: str
    permissions: list[str] = []

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
