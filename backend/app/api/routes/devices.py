from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.device import Device
from app.models.user import User, UserRole
from app.schemas.devices import (
    DeviceCreate,
    DeviceResponse,
    DeviceUpdate,
    OfflineSweepResponse,
    ReconcileTrafficResponse,
)
from app.services.device_linking import backfill_traffic_device_links, mark_stale_devices_offline
from app.services.device_metadata import sanitize_device_metadata

router = APIRouter(prefix="/devices", tags=["devices"])


def _get_device(db: Session, device_id: int, current_user: User) -> Device | None:
    query = db.query(Device).filter(Device.id == device_id)
    if current_user.role != UserRole.admin:
        query = query.filter(Device.user_id == current_user.id)
    return query.first()


@router.post("/sweep-offline-status", response_model=OfflineSweepResponse)
def sweep_offline_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OfflineSweepResponse:
    """Mark inventory assets offline when no traffic has been observed within the configured window."""
    scoped_all = current_user.role == UserRole.admin
    n = mark_stale_devices_offline(db, user_id=current_user.id, scoped_to_all_devices=scoped_all)
    db.commit()
    return OfflineSweepResponse(devices_marked_offline=n)


@router.get("", response_model=list[DeviceResponse])
def list_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DeviceResponse]:
    scoped_all = current_user.role == UserRole.admin
    mark_stale_devices_offline(db, user_id=current_user.id, scoped_to_all_devices=scoped_all)
    db.commit()
    query = db.query(Device)
    if current_user.role != UserRole.admin:
        query = query.filter(Device.user_id == current_user.id)
    return query.order_by(Device.created_at.desc()).all()


@router.get("/me", response_model=list[DeviceResponse])
def list_my_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DeviceResponse]:
    mark_stale_devices_offline(db, user_id=current_user.id, scoped_to_all_devices=False)
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
    current_user: User = Depends(get_current_user),
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
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    backfill_traffic_device_links(db, device)
    db.commit()
    db.refresh(device)
    return device


@router.post("/{device_id}/reconcile-traffic", response_model=ReconcileTrafficResponse)
def reconcile_traffic_for_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
) -> DeviceResponse:
    device = _get_device(db, device_id, current_user)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return device


@router.put("/{device_id}", response_model=DeviceResponse)
def update_device(
    device_id: int,
    payload: DeviceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    db.commit()
    db.refresh(device)
    return device


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    device = _get_device(db, device_id, current_user)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    db.delete(device)
    db.commit()
    return None
