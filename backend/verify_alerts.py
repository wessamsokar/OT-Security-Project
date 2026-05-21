import asyncio
from datetime import datetime, timezone
import httpx
import json

from app.db.session import SessionLocal
from app.models.alert import Alert
from app.models.traffic_record import TrafficRecord
from app.api.routes.traffic import sync_device_after_detection, sync_edge_from_traffic_record
from app.services.alerts import make_alert_summary, severity_from_ml_alert_string


from app.models.user import User

def create_test_alert(db, risk_score, ml_status, alert_sev, attack_detected, summary):
    user = db.query(User).first()
    user_id = user.id if user else None

    # 1. Create Traffic Record
    record = TrafficRecord(
        user_id=user_id,
        source_ip="10.10.1.5",
        destination_ip="10.10.1.25",
        source_port=50000,
        destination_port=502,
        transport_protocol="tcp",
        packet_count=100,
        bytes_in=1000,
        bytes_out=1000,
        duration_ms=100,
        payload_entropy=5.0,
        modbus_function_code=1,
        modbus_unit_id=1,
        dnp3_function_code=0,
        iec104_type_id=0,
        ingestion_source="json",
        metadata_json={"test": True},
        risk_score=risk_score,
        ml_status=ml_status,
        ml_alert_severity=alert_sev,
        ml_attack_detected=attack_detected,
        attack_class="test_attack",
        confidence=0.9,
        explanation_json={"reason": "test"},
        created_at=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db.add(record)
    db.flush()

    # 2. Create Alert
    alert = None
    if attack_detected:
        alert_orm_sev = severity_from_ml_alert_string(alert_sev)
        alert = Alert(
            traffic_record_id=record.id,
            severity=alert_orm_sev,
            summary=make_alert_summary("test_attack", ml_status, alert_sev, risk_score) + " - " + summary
        )
        db.add(alert)
        db.flush()

    # 3. Trigger Device Operational Sync
    sync_device_after_detection(
        db,
        record.device_id,
        traffic_id=record.id,
        risk_score=risk_score,
        ml_status=ml_status,
        evaluated_at=record.created_at
    )
    
    # 4. Trigger Topology Sync
    sync_edge_from_traffic_record(db, record)
    db.commit()
    
    if alert:
        print(f"Created Alert: ID={alert.id}, Severity={alert.severity}, Summary={alert.summary}")

def main():
    db = SessionLocal()
    try:
        print("Generating LOW alert...")
        create_test_alert(db, 0.15, "normal", "low", True, "Test LOW Anomaly")
        
        print("Generating MEDIUM alert...")
        create_test_alert(db, 0.45, "suspicious", "medium", True, "Test MEDIUM Suspicious")
        
        print("Generating HIGH alert...")
        create_test_alert(db, 0.75, "under_attack", "high", True, "Test HIGH Threat")
        
        print("Generating CRITICAL alert...")
        create_test_alert(db, 0.95, "under_attack", "critical", True, "Test CRITICAL Compromise")
    finally:
        db.close()

if __name__ == "__main__":
    main()
