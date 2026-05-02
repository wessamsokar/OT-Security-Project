from datetime import datetime

from pydantic import BaseModel, Field


class PermissionBase(BaseModel):
    code: str = Field(min_length=3, max_length=64, pattern="^[a-zA-Z0-9_.:-]+$")
    description: str | None = Field(default=None, max_length=255)


class PermissionCreate(PermissionBase):
    pass


class PermissionUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=3, max_length=64, pattern="^[a-zA-Z0-9_.:-]+$")
    description: str | None = Field(default=None, max_length=255)


class PermissionResponse(PermissionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RoleBase(BaseModel):
    name: str = Field(min_length=2, max_length=64, pattern="^[a-zA-Z0-9_.:-]+$")
    description: str | None = Field(default=None, max_length=255)
    permission_ids: list[int] = Field(default_factory=list)


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=64, pattern="^[a-zA-Z0-9_.:-]+$")
    description: str | None = Field(default=None, max_length=255)
    permission_ids: list[int] | None = None


class RoleResponse(BaseModel):
    id: int
    name: str
    description: str | None
    is_system: bool
    created_at: datetime
    permissions: list[PermissionResponse] = Field(default_factory=list)

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
