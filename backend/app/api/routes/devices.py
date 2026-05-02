from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.device import Device
from app.models.user import User, UserRole
from app.schemas.devices import DeviceCreate, DeviceResponse, DeviceUpdate

router = APIRouter(prefix="/devices", tags=["devices"])


def _get_device(db: Session, device_id: int, current_user: User) -> Device | None:
    query = db.query(Device).filter(Device.id == device_id)
    if current_user.role != UserRole.admin:
        query = query.filter(Device.user_id == current_user.id)
    return query.first()


@router.get("", response_model=list[DeviceResponse])
def list_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DeviceResponse]:
    query = db.query(Device)
    if current_user.role != UserRole.admin:
        query = query.filter(Device.user_id == current_user.id)
    return query.order_by(Device.created_at.desc()).all()


@router.post("", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
def create_device(
    payload: DeviceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeviceResponse:
    device = Device(
        user_id=current_user.id,
        name=payload.name.strip(),
        device_type=payload.device_type,
        ip_address=str(payload.ip_address) if payload.ip_address else None,
        serial_number=payload.serial_number,
        location=payload.location,
        metadata_json=payload.metadata_json,
        is_active=payload.is_active,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


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
        device.metadata_json = payload.metadata_json
    if payload.is_active is not None:
        device.is_active = payload.is_active

    db.add(device)
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
