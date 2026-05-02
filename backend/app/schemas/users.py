from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.viewer
    is_active: bool = True
    is_email_verified: bool = False


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=50)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role: UserRole | None = None
    is_active: bool | None = None
    is_email_verified: bool | None = None


class UserAdminResponse(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    is_active: bool
    is_email_verified: bool
    email_verified_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True