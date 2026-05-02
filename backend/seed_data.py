from datetime import datetime

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.traffic_record import TrafficRecord
from app.models.user import User, UserRole


def main() -> None:
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            db.add_all(
                [
                    User(
                        username="admin",
                        email="admin@ics.local",
                        hashed_password=get_password_hash("admin123"),
                        role=UserRole.admin,
                    ),
                    User(
                        username="customer",
                        email="customer@ics.local",
                        hashed_password=get_password_hash("customer123"),
                        role=UserRole.customer,
                    ),
                ]
            )

        if db.query(TrafficRecord).count() == 0:
            record = TrafficRecord(
                source_ip="10.10.1.5",
                destination_ip="10.10.1.25",
                source_port=50011,
                destination_port=502,
                transport_protocol="tcp",
                packet_count=120,
                bytes_in=6400,
                bytes_out=8000,
                duration_ms=320,
                payload_entropy=6.1,
                modbus_function_code=16,
                modbus_unit_id=3,
                dnp3_function_code=1,
                iec104_type_id=45,
                ingestion_source="json",
                metadata_json={"site": "north-substation"},
                risk_score=0.86,
                attack_class="dos",
                confidence=0.81,
                explanation_json={"top_features": [{"feature": "packet_count", "importance": 0.44}]},
                created_at=datetime.utcnow(),
            )
            db.add(record)
            db.flush()

            db.add(
                Alert(
                    traffic_record_id=record.id,
                    severity=AlertSeverity.high,
                    status=AlertStatus.new,
                    summary="Seeded alert for demo dashboard",
                )
            )

        db.commit()
        print("Seed complete")
    finally:
        db.close()


if __name__ == "__main__":
    main()