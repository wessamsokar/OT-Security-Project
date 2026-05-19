from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.db.session import get_db
from app.models.device import Device
from app.models.user import User, UserRole
from app.services.tenant import get_accessible_tenant_ids
from app.schemas.devices import (
    DeviceCreate,
    DeviceResponse,
    DeviceUpdate,
    OfflineSweepResponse,
    ReconcileTrafficResponse,
)
from app.services.device_linking import backfill_traffic_device_links, mark_stale_devices_offline
from app.services.device_metadata import sanitize_device_metadata
from app.services.device_operational import refresh_device_operational_state
from app.services.topology import sync_metadata_edges_for_device

router = APIRouter(prefix="/devices", tags=["devices"])


def _get_device(db: Session, device_id: int, current_user: User, tenant_id: int | None = None) -> Device | None:
    query = db.query(Device).filter(Device.id == device_id)
    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)
    if tenant_ids is not None:
        query = query.filter(Device.user_id.in_(tenant_ids))
    return query.first()


@router.post("/sweep-offline-status", response_model=OfflineSweepResponse)
def sweep_offline_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("edit_devices")),
    tenant_id: int | None = Query(default=None),
) -> OfflineSweepResponse:
    """Mark inventory assets offline when no traffic has been observed within the configured window."""
    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)
    n = mark_stale_devices_offline(db, tenant_ids=tenant_ids)
    db.commit()
    return OfflineSweepResponse(devices_marked_offline=n)


@router.get("", response_model=list[DeviceResponse])
def list_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("view_devices")),
    tenant_id: int | None = Query(default=None),
) -> list[DeviceResponse]:
    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)
    mark_stale_devices_offline(db, tenant_ids=tenant_ids)
    db.commit()
    query = db.query(Device)
    if tenant_ids is not None:
        query = query.filter(Device.user_id.in_(tenant_ids))
    devices = query.order_by(Device.created_at.desc()).all()
    for device in devices:
        refresh_device_operational_state(device)
    db.commit()
    return devices


@router.get("/me", response_model=list[DeviceResponse])
def list_my_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("view_devices")),
) -> list[DeviceResponse]:
    # list_my_devices is strictly for the logged in user
    mark_stale_devices_offline(db, tenant_ids=[current_user.id])
    db.commit()
    return (
        db.query(Device)
        .filter(Device.user_id == current_user.id)
        .order_by(Device.created_at.desc())
        .all()
    )


@router.post("", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
def create_device(
    payload: DeviceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("create_devices")),
) -> DeviceResponse:
    meta = sanitize_device_metadata(dict(payload.metadata_json or {}))
    device = Device(
        user_id=current_user.id,
        name=payload.name.strip(),
        device_type=payload.device_type,
        ip_address=str(payload.ip_address) if payload.ip_address else None,
        serial_number=payload.serial_number,
        location=payload.location,
        metadata_json=meta,
        is_active=payload.is_active,
        monitoring_status="offline",
        operational_state="unknown",
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    backfill_traffic_device_links(db, device)
    sync_metadata_edges_for_device(db, device)
    refresh_device_operational_state(device)
    db.commit()
    db.refresh(device)
    return device


@router.post("/{device_id}/reconcile-traffic", response_model=ReconcileTrafficResponse)
def reconcile_traffic_for_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("edit_devices")),
) -> ReconcileTrafficResponse:
    """Attach historical TrafficRecord rows to this inventory asset by IP."""
    device = _get_device(db, device_id, current_user)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    n = backfill_traffic_device_links(db, device)
    db.commit()
    return ReconcileTrafficResponse(linked_records=n)


@router.get("/{device_id}", response_model=DeviceResponse)
def get_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("view_devices")),
    tenant_id: int | None = Query(default=None),
) -> DeviceResponse:
    device = _get_device(db, device_id, current_user, tenant_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return device


@router.put("/{device_id}", response_model=DeviceResponse)
def update_device(
    device_id: int,
    payload: DeviceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("edit_devices")),
) -> DeviceResponse:
    device = _get_device(db, device_id, current_user)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    if payload.name is not None:
        device.name = payload.name.strip()
    if payload.device_type is not None:
        device.device_type = payload.device_type
    if payload.ip_address is not None:
        device.ip_address = str(payload.ip_address)
    if payload.serial_number is not None:
        device.serial_number = payload.serial_number
    if payload.location is not None:
        device.location = payload.location
    if payload.metadata_json is not None:
        merged = {**dict(device.metadata_json or {}), **dict(payload.metadata_json)}
        device.metadata_json = sanitize_device_metadata(merged)
    if payload.is_active is not None:
        device.is_active = payload.is_active

    db.add(device)
    db.commit()
    db.refresh(device)
    backfill_traffic_device_links(db, device)
    sync_metadata_edges_for_device(db, device)
    refresh_device_operational_state(device)
    db.commit()
    db.refresh(device)
    return device


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("delete_devices")),
) -> None:
    device = _get_device(db, device_id, current_user)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    db.delete(device)
    db.commit()
    return None
