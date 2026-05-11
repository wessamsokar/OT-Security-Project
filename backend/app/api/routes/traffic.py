from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.models.alert import Alert
from app.models.model_version import ModelVersion
from app.models.traffic_record import TrafficRecord
from app.models.user import UserRole
from app.schemas.traffic import (
    DetectionResponse,
    ICSTrafficIn,
    PacketsByHourResponse,
    PacketsByHourRow,
    TrafficRecordResponse,
)
from app.services.alerts import (
    make_alert_summary,
    severity_from_ml_alert_string,
    should_generate_alert_from_ml,
)
from app.services.device_linking import (
    mark_stale_devices_offline,
    resolve_device_id_for_flow,
    sync_device_after_detection,
    touch_device_last_traffic,
)
from app.services.ml_client import run_inference
from app.services.ml_infer_contract import validate_ml_infer_response
from app.db.session import get_db

router = APIRouter(prefix="/traffic", tags=["traffic"])


def _is_admin(user) -> bool:
    return bool(user.role and user.role.value == UserRole.admin.value)


def _payload_from_record(record: TrafficRecord) -> dict:
    """
    Same fields as ml-service InferRequest; normalized so /infer maps to NetworkFlow
    (same shape as POST /predict: duration, sPackets, protocol, sAddress, ICS columns).
    """
    proto = (record.transport_protocol or "tcp").lower().strip()
    if proto not in ("tcp", "udp", "icmp"):
        proto = "tcp"

    def zint(v: int | None) -> int:
        return 0 if v is None else int(v)

    return {
        "packet_count": record.packet_count,
        "bytes_in": record.bytes_in,
        "bytes_out": record.bytes_out,
        "duration_ms": record.duration_ms,
        "payload_entropy": record.payload_entropy,
        "source_port": record.source_port,
        "destination_port": record.destination_port,
        "modbus_function_code": zint(record.modbus_function_code),
        "modbus_unit_id": zint(record.modbus_unit_id),
        "dnp3_function_code": zint(record.dnp3_function_code),
        "iec104_type_id": zint(record.iec104_type_id),
        "transport_protocol": proto,
        "source_ip": record.source_ip,
        "destination_ip": record.destination_ip,
    }


@router.post("/ingest", response_model=TrafficRecordResponse)
def ingest_traffic(
    payload: ICSTrafficIn,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.admin, UserRole.customer)),
) -> TrafficRecordResponse:
    src_ip = str(payload.source_ip)
    dst_ip = str(payload.destination_ip)
    matched = resolve_device_id_for_flow(db, current_user.id, src_ip, dst_ip)

    record = TrafficRecord(
        user_id=current_user.id,
        source_ip=src_ip,
        destination_ip=dst_ip,
        source_port=payload.source_port,
        destination_port=payload.destination_port,
        transport_protocol=payload.transport_protocol,
        packet_count=payload.packet_count,
        bytes_in=payload.bytes_in,
        bytes_out=payload.bytes_out,
        duration_ms=payload.duration_ms,
        payload_entropy=payload.payload_entropy,
        modbus_function_code=payload.modbus_function_code,
        modbus_unit_id=payload.modbus_unit_id,
        dnp3_function_code=payload.dnp3_function_code,
        iec104_type_id=payload.iec104_type_id,
        ingestion_source=payload.ingestion_source,
        metadata_json=payload.metadata_json,
        device_id=matched,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    touch_device_last_traffic(db, matched)
    mark_stale_devices_offline(db, user_id=current_user.id, scoped_to_all_devices=False)
    db.commit()
    return record


@router.post("/{record_id}/detect", response_model=DetectionResponse)
async def run_detection(
    record_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.admin, UserRole.customer)),
) -> DetectionResponse:
    query = db.query(TrafficRecord).filter(TrafficRecord.id == record_id)
    if not _is_admin(current_user):
        query = query.filter(TrafficRecord.user_id == current_user.id)
    record = query.first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if record.device_id is None and record.user_id is not None:
        record.device_id = resolve_device_id_for_flow(
            db,
            record.user_id,
            record.source_ip,
            record.destination_ip,
        )

    raw = await run_inference(_payload_from_record(record))
    verdict = validate_ml_infer_response(dict(raw))

    active_model = (
        db.query(ModelVersion)
        .filter(ModelVersion.is_active.is_(True))
        .order_by(ModelVersion.created_at.desc())
        .first()
    )

    ml_status = str(verdict["ml_status"])
    alert_sev = str(verdict["alert_severity"])
    attack_detected = bool(verdict["attack_detected"])

    record.risk_score = verdict["risk_score"]
    record.ml_status = ml_status
    record.ml_alert_severity = alert_sev
    record.ml_attack_detected = attack_detected
    record.attack_class = str(verdict["attack_class"])
    record.confidence = float(verdict["confidence"])
    record.explanation_json = dict(verdict)

    if active_model:
        record.model_version_id = active_model.id

    evaluated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    if should_generate_alert_from_ml(attack_detected):
        try:
            alert_orm_sev = severity_from_ml_alert_string(alert_sev)
        except ValueError as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Invalid alert_severity from ML after validation: {exc}",
            ) from exc
        alert = Alert(
            traffic_record_id=record.id,
            severity=alert_orm_sev,
            summary=make_alert_summary(
                record.attack_class,
                ml_status,
                alert_sev,
                record.risk_score,
            ),
        )
        db.add(alert)

    db.add(record)
    sync_device_after_detection(
        db,
        record.device_id,
        traffic_id=record.id,
        risk_score=record.risk_score,
        ml_status=ml_status,
        evaluated_at=evaluated_at,
    )
    db.commit()

    mark_stale_devices_offline(
        db,
        user_id=current_user.id,
        scoped_to_all_devices=_is_admin(current_user),
    )
    db.commit()

    return DetectionResponse(
        record_id=record.id,
        risk_score=record.risk_score,
        ml_status=ml_status,
        alert_severity=alert_sev,
        attack_detected=attack_detected,
        device_id=record.device_id,
        attack_class=record.attack_class or "",
        confidence=record.confidence or 0.0,
        explanation=verdict["explanation"]
        if isinstance(verdict["explanation"], dict)
        else {},
        model_version=active_model.version if active_model else None,
    )


@router.get("/packets-by-hour", response_model=PacketsByHourResponse)
def packets_by_hour(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.admin, UserRole.customer)),
) -> PacketsByHourResponse:
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    query = db.query(TrafficRecord).filter(TrafficRecord.created_at >= since)
    if not _is_admin(current_user):
        query = query.filter(TrafficRecord.user_id == current_user.id)
    records = query.all()

    per_hour_packets: dict[str, int] = defaultdict(int)
    per_hour_protocols: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for record in records:
        hour_key = record.created_at.strftime("%H:00")
        per_hour_packets[hour_key] += int(record.packet_count)
        protocol = record.transport_protocol.upper()
        per_hour_protocols[hour_key][protocol] += int(record.packet_count)

    rows: list[PacketsByHourRow] = []
    for hour in sorted(per_hour_packets.keys()):
        protocol_counts = per_hour_protocols[hour]
        dominant_protocol = max(protocol_counts, key=protocol_counts.get) if protocol_counts else "N/A"
        rows.append(PacketsByHourRow(hour=hour, packets=per_hour_packets[hour], dominant_protocol=dominant_protocol))

    today_total = sum(per_hour_packets.values())
    avg_per_minute = int(today_total / (24 * 60)) if today_total else 0
    peak_hour = max(per_hour_packets, key=per_hour_packets.get) if per_hour_packets else "N/A"

    return PacketsByHourResponse(
        today_total=today_total,
        avg_per_minute=avg_per_minute,
        peak_hour=peak_hour,
        rows=rows,
    )
