from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.models.alert import Alert
from app.models.model_version import ModelVersion
from app.models.traffic_record import TrafficRecord
from app.models.user import UserRole
from app.schemas.traffic import DetectionResponse, ICSTrafficIn, TrafficRecordResponse
from app.services.alerts import make_alert_summary, score_to_severity, should_generate_alert
from app.services.ml_client import run_inference
from app.db.session import get_db

router = APIRouter(prefix="/traffic", tags=["traffic"])


def _payload_from_record(record: TrafficRecord) -> dict:
    return {
        "packet_count": record.packet_count,
        "bytes_in": record.bytes_in,
        "bytes_out": record.bytes_out,
        "duration_ms": record.duration_ms,
        "payload_entropy": record.payload_entropy,
        "source_port": record.source_port,
        "destination_port": record.destination_port,
        "modbus_function_code": record.modbus_function_code,
        "modbus_unit_id": record.modbus_unit_id,
        "dnp3_function_code": record.dnp3_function_code,
        "iec104_type_id": record.iec104_type_id,
        "transport_protocol": record.transport_protocol,
    }


@router.post("/ingest", response_model=TrafficRecordResponse)
def ingest_traffic(
    payload: ICSTrafficIn,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(UserRole.admin, UserRole.analyst)),
) -> TrafficRecordResponse:
    record = TrafficRecord(
        source_ip=str(payload.source_ip),
        destination_ip=str(payload.destination_ip),
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
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.post("/{record_id}/detect", response_model=DetectionResponse)
async def run_detection(
    record_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(UserRole.admin, UserRole.analyst)),
) -> DetectionResponse:
    record = db.query(TrafficRecord).filter(TrafficRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    result = await run_inference(_payload_from_record(record))

    active_model = (
        db.query(ModelVersion)
        .filter(ModelVersion.is_active.is_(True))
        .order_by(ModelVersion.created_at.desc())
        .first()
    )

    record.risk_score = result["risk_score"]
    record.attack_class = result["attack_class"]
    record.confidence = result["confidence"]
    record.explanation_json = result["explanation"]
    if active_model:
        record.model_version_id = active_model.id

    if should_generate_alert(record.risk_score, record.confidence):
        alert = Alert(
            traffic_record_id=record.id,
            severity=score_to_severity(record.risk_score),
            summary=make_alert_summary(record.attack_class, record.risk_score),
        )
        db.add(alert)

    db.add(record)
    db.commit()

    return DetectionResponse(
        record_id=record.id,
        risk_score=record.risk_score,
        attack_class=record.attack_class,
        confidence=record.confidence,
        explanation=result["explanation"],
        model_version=active_model.version if active_model else None,
    )
