from datetime import datetime

from pydantic import BaseModel, Field


class RoleBase(BaseModel):
    name: str = Field(min_length=2, max_length=64, pattern="^[a-zA-Z0-9_.:-]+$")
    description: str | None = Field(default=None, max_length=255)


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=64, pattern="^[a-zA-Z0-9_.:-]+$")
    description: str | None = Field(default=None, max_length=255)


class RoleResponse(BaseModel):
    id: int
    name: str
    description: str | None
    is_system: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RoleSummary(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class UserRoleUpdate(BaseModel):
    role_ids: list[int] = Field(default_factory=list)


class UserRolesResponse(BaseModel):
    user_id: int
    roles: list[RoleSummary]
