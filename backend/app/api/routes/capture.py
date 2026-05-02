import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.api.dependencies import require_roles
from app.core.config import get_settings
from app.models.user import User, UserRole
from app.schemas.capture import (
    PacketCaptureRequest,
    PacketCaptureResponse,
    PacketCaptureStatusResponse,
    PacketCaptureStopRequest,
)
from app.services.packet_capture import (
    get_packet_capture_status,
    start_packet_capture,
    stop_packet_capture,
)

router = APIRouter(prefix="/packet-capture", tags=["packet-capture"])
settings = get_settings()


@router.post("", response_model=PacketCaptureResponse, status_code=status.HTTP_202_ACCEPTED)
def capture_packets(
    payload: PacketCaptureRequest,
    background_tasks: BackgroundTasks,
    _user: User = Depends(require_roles(UserRole.admin, UserRole.customer)),
) -> PacketCaptureResponse:
    try:
        import scapy.all  # noqa: F401
    except ImportError as exc:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Scapy is not installed") from exc

    capture_id = str(uuid.uuid4())
    file_name = Path(payload.output_filename).name if payload.output_filename else ""
    if not file_name:
        file_name = f"capture_{capture_id}.pcap"
    capture_dir = Path(settings.packet_capture_dir)
    capture_dir.mkdir(parents=True, exist_ok=True)
    file_path = capture_dir / file_name

    background_tasks.add_task(
        start_packet_capture,
        capture_id=capture_id,
        file_path=file_path,
        interface=payload.interface,
        duration_seconds=payload.duration_seconds,
        packet_count=payload.packet_count,
        bpf_filter=payload.bpf_filter,
    )

    return PacketCaptureResponse(capture_id=capture_id, status="started", file_path=str(file_path))


@router.post("/stop", response_model=PacketCaptureStatusResponse)
def stop_capture(
    payload: PacketCaptureStopRequest,
    _user: User = Depends(require_roles(UserRole.admin, UserRole.customer)),
) -> PacketCaptureStatusResponse:
    status_value = stop_packet_capture(payload.capture_id)
    if status_value is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Capture session not found")
    return PacketCaptureStatusResponse(capture_id=payload.capture_id, status=status_value)


@router.get("/{capture_id}/status", response_model=PacketCaptureStatusResponse)
def capture_status(
    capture_id: str,
    _user: User = Depends(require_roles(UserRole.admin, UserRole.customer)),
) -> PacketCaptureStatusResponse:
    status_value = get_packet_capture_status(capture_id)
    if status_value is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Capture session not found")
    return PacketCaptureStatusResponse(capture_id=capture_id, status=status_value)
