from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.db.session import get_db
from app.models.rbac import Permission, Role
from app.models.user import User, UserRole
from app.schemas.rbac import (
    PermissionCreate,
    PermissionResponse,
    PermissionUpdate,
    RoleCreate,
    RoleResponse,
    RoleUpdate,
    UserRoleUpdate,
    UserRolesResponse,
)

router = APIRouter(prefix="/rbac", tags=["rbac"])


def _resolve_permissions(db: Session, permission_ids: list[int]) -> list[Permission]:
    if not permission_ids:
        return []
    permissions = db.query(Permission).filter(Permission.id.in_(permission_ids)).all()
    if len(permissions) != len(set(permission_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid permission ids")
    return permissions


@router.get("/roles", response_model=list[RoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
) -> list[RoleResponse]:
    return db.query(Role).order_by(Role.name.asc()).all()


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
) -> RoleResponse:
    name = payload.name.strip()
    existing = db.query(Role).filter(func.lower(Role.name) == name.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role already exists")

    permissions = _resolve_permissions(db, payload.permission_ids)
    role = Role(name=name, description=payload.description, is_system=False, permissions=permissions)
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.get("/roles/{role_id}", response_model=RoleResponse)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
) -> RoleResponse:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    return role


@router.put("/roles/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
) -> RoleResponse:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    if payload.name is not None:
        if role.is_system and payload.name != role.name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="System roles cannot be renamed")
        name = payload.name.strip()
        existing = (
            db.query(Role)
            .filter(func.lower(Role.name) == name.lower(), Role.id != role.id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role already exists")
        role.name = name

    if payload.description is not None:
        role.description = payload.description

    if payload.permission_ids is not None:
        role.permissions = _resolve_permissions(db, payload.permission_ids)

    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
) -> None:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="System roles cannot be deleted")
    db.delete(role)
    db.commit()
    return None


@router.get("/permissions", response_model=list[PermissionResponse])
def list_permissions(
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
) -> list[PermissionResponse]:
    return db.query(Permission).order_by(Permission.code.asc()).all()


@router.post("/permissions", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED)
def create_permission(
    payload: PermissionCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
) -> PermissionResponse:
    code = payload.code.strip()
    existing = db.query(Permission).filter(func.lower(Permission.code) == code.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Permission already exists")

    permission = Permission(code=code, description=payload.description)
    db.add(permission)
    db.commit()
    db.refresh(permission)
    return permission


@router.get("/permissions/{permission_id}", response_model=PermissionResponse)
def get_permission(
    permission_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
) -> PermissionResponse:
    permission = db.query(Permission).filter(Permission.id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    return permission


@router.put("/permissions/{permission_id}", response_model=PermissionResponse)
def update_permission(
    permission_id: int,
    payload: PermissionUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
) -> PermissionResponse:
    permission = db.query(Permission).filter(Permission.id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")

    if payload.code is not None:
        code = payload.code.strip()
        existing = (
            db.query(Permission)
            .filter(func.lower(Permission.code) == code.lower(), Permission.id != permission.id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Permission already exists")
        permission.code = code

    if payload.description is not None:
        permission.description = payload.description

    db.add(permission)
    db.commit()
    db.refresh(permission)
    return permission


@router.delete("/permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_permission(
    permission_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
) -> None:
    permission = db.query(Permission).filter(Permission.id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    db.delete(permission)
    db.commit()
    return None


@router.get("/users/{user_id}/roles", response_model=UserRolesResponse)
def list_user_roles(
    user_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
) -> UserRolesResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserRolesResponse(user_id=user.id, roles=user.roles)


@router.put("/users/{user_id}/roles", response_model=UserRolesResponse)
def update_user_roles(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
) -> UserRolesResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    roles = db.query(Role).filter(Role.id.in_(payload.role_ids)).all() if payload.role_ids else []
    if len(roles) != len(set(payload.role_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role ids")

    user.roles = roles
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserRolesResponse(user_id=user.id, roles=user.roles)
