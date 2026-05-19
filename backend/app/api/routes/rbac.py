import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import String, cast, func, literal, or_, select, union_all
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies import require_all_permissions, require_permission
from app.db.session import get_db
from app.models.permission import Permission
from app.models.rbac import Role
from app.models.user import User
from app.schemas.rbac import (
    PermissionResponse,
    RoleCreate,
    RoleResponse,
    RoleUpdate,
    UserRoleUpdate,
    UserRolesResponse,
)
from app.schemas.users import UserAdminResponse

router = APIRouter(prefix="/rbac", tags=["rbac"])
logger = logging.getLogger(__name__)


def _normalized_role_expr(column) -> object:
    return func.lower(func.trim(column))


def _role_assignment_sources(db: Session, role_ids: list[int]):
    from app.models.rbac import user_roles as user_roles_table  # noqa: PLC0415

    role_key_subq = (
        select(
            Role.id.label("role_id"),
            _normalized_role_expr(Role.name).label("role_key"),
        )
    ).subquery()

    user_role_key = _normalized_role_expr(cast(User.role, String))

    assignments = (
        union_all(
            select(
                user_roles_table.c.role_id.label("role_id"),
                user_roles_table.c.user_id.label("user_id"),
                literal("user_roles").label("source"),
            ),
            select(
                role_key_subq.c.role_id,
                User.id.label("user_id"),
                literal("user.role").label("source"),
            ).select_from(User).join(role_key_subq, role_key_subq.c.role_key == user_role_key),
        )
    ).subquery()

    if role_ids:
        assignments = select(assignments).where(assignments.c.role_id.in_(role_ids)).subquery()

    return assignments


def _role_assignment_counts(db: Session, role_ids: list[int]) -> tuple[dict[int, int], dict[int, dict[str, int]]]:
    assignments = _role_assignment_sources(db, role_ids)

    total_rows = db.execute(
        select(
            assignments.c.role_id,
            func.count(func.distinct(assignments.c.user_id)).label("cnt"),
        ).group_by(assignments.c.role_id)
    ).fetchall()
    total_map = {row.role_id: row.cnt for row in total_rows}

    source_rows = db.execute(
        select(
            assignments.c.role_id,
            assignments.c.source,
            func.count(func.distinct(assignments.c.user_id)).label("cnt"),
        ).group_by(assignments.c.role_id, assignments.c.source)
    ).fetchall()

    source_map: dict[int, dict[str, int]] = {}
    for row in source_rows:
        source_map.setdefault(row.role_id, {})[row.source] = row.cnt

    return total_map, source_map


def _permissions_by_ids(db: Session, permission_ids: list[int]) -> list[Permission]:
    if not permission_ids:
        return []
    unique_ids = set(permission_ids)
    permissions = db.query(Permission).filter(Permission.id.in_(unique_ids)).all()
    if len(permissions) != len(unique_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid permission ids")
    return permissions


@router.get("/permissions", response_model=list[PermissionResponse])
def list_permissions(
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("view_roles")),
) -> list[PermissionResponse]:
    return db.query(Permission).order_by(Permission.code.asc()).all()


@router.get("/roles", response_model=list[RoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("view_roles")),
) -> list[RoleResponse]:
    roles = db.query(Role).options(joinedload(Role.permissions)).order_by(Role.name.asc()).all()
    role_ids = [role.id for role in roles]
    count_map, source_map = _role_assignment_counts(db, role_ids)

    logger.info(
        "rbac.roles.list roles=%s count_map=%s source_map=%s",
        [role.name for role in roles],
        count_map,
        source_map,
    )

    for role in roles:
        role.assigned_users_count = count_map.get(role.id, 0)
        logger.info(
            "rbac.roles.list.role role_id=%s role=%s count=%s sources=%s",
            role.id,
            role.name,
            role.assigned_users_count,
            source_map.get(role.id, {}),
        )
    return roles


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_all_permissions("manage_roles", "manage_permissions")),
) -> RoleResponse:
    name = payload.name.strip()
    existing = db.query(Role).filter(func.lower(Role.name) == name.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role already exists")

    role = Role(name=name, description=payload.description, is_system=False)
    role.permissions = _permissions_by_ids(db, payload.permission_ids)
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.get("/roles/{role_id}", response_model=RoleResponse)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("view_roles")),
) -> RoleResponse:
    role = db.query(Role).options(joinedload(Role.permissions)).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    count_map, source_map = _role_assignment_counts(db, [role.id])
    role.assigned_users_count = count_map.get(role.id, 0)

    logger.info(
        "rbac.roles.get role_id=%s role=%s count=%s sources=%s",
        role.id,
        role.name,
        role.assigned_users_count,
        source_map.get(role.id, {}),
    )
    return role


@router.put("/roles/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_all_permissions("manage_roles", "manage_permissions")),
) -> RoleResponse:
    role = db.query(Role).options(joinedload(Role.permissions)).filter(Role.id == role_id).first()
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
        if role.is_system:
            # Only checking if it's actually changing. Or just block it outright.
            current_ids = {p.id for p in role.permissions}
            new_ids = set(payload.permission_ids)
            if current_ids != new_ids:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="System role permissions cannot be modified")
        role.permissions = _permissions_by_ids(db, payload.permission_ids)

    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("manage_roles")),
) -> None:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="System roles cannot be deleted")
    db.delete(role)
    db.commit()
    return None


@router.get("/roles/{role_id}/users", response_model=list[UserAdminResponse])
def get_role_users(
    role_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("view_users")),
) -> list[UserAdminResponse]:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    role_key = role.name.strip().lower()
    users = (
        db.query(User)
        .filter(
            or_(
                User.roles.any(Role.id == role_id),
                _normalized_role_expr(cast(User.role, String)) == role_key,
            )
        )
        .distinct()
        .order_by(User.username.asc())
        .all()
    )
    return users


@router.get("/users/{user_id}/roles", response_model=UserRolesResponse)
def list_user_roles(
    user_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("view_roles")),
) -> UserRolesResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    roles = list(user.roles) if user.roles else []
    if user.role:
        if hasattr(user.role, "value"):
            role_key = str(user.role.value)
        else:
            role_key = str(user.role)
        role_key = role_key.split(".")[-1].strip().lower()
        primary_role = db.query(Role).filter(_normalized_role_expr(Role.name) == role_key).first()
        if primary_role and all(role.id != primary_role.id for role in roles):
            roles.append(primary_role)
    return UserRolesResponse(user_id=user.id, roles=roles)


@router.put("/users/{user_id}/roles", response_model=UserRolesResponse)
def update_user_roles(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("manage_roles")),
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
