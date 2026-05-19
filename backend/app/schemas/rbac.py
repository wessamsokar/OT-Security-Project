from datetime import datetime

from pydantic import BaseModel, Field


class RoleBase(BaseModel):
    name: str = Field(min_length=2, max_length=64, pattern="^[a-zA-Z0-9_.:-]+$")
    description: str | None = Field(default=None, max_length=255)


class RoleCreate(RoleBase):
    permission_ids: list[int] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=64, pattern="^[a-zA-Z0-9_.:-]+$")
    description: str | None = Field(default=None, max_length=255)
    permission_ids: list[int] | None = None


class PermissionResponse(BaseModel):
    id: int
    code: str
    description: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class RoleResponse(BaseModel):
    id: int
    name: str
    description: str | None
    is_system: bool
    created_at: datetime
    permissions: list[PermissionResponse] = []
    assigned_users_count: int = 0

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
