import sys
from app.db.session import SessionLocal
from app.models.device import Device
from app.models.user import User
from app.models.traffic_record import TrafficRecord
from app.services.device_linking import resolve_device_id_for_flow
from fastapi.testclient import TestClient
from app.main import app

def main():
    db = SessionLocal()
    user = db.query(User).first()
    if not user:
        print("No user found")
        return

    # 1. Create two devices
    dev_a = Device(user_id=user.id, name="Test PLC A", ip_address="192.168.100.10", device_type="plc", is_active=True, monitoring_status="offline")
    dev_b = Device(user_id=user.id, name="Test HMI B", ip_address="192.168.100.20", device_type="hmi", is_active=True, monitoring_status="offline")
    db.add(dev_a)
    db.add(dev_b)
    db.flush()
    print(f"Created dev_a={dev_a.id}, dev_b={dev_b.id}")
    
    # 2. Link them manually via metadata
    from app.services.topology import sync_metadata_edges_for_device
    dev_b.metadata_json = {"parent_device_id": dev_a.id}
    db.flush()
    sync_metadata_edges_for_device(db, dev_b)
    db.commit()

    from app.models.topology_edge import TopologyEdge
    edges = db.query(TopologyEdge).filter(TopologyEdge.source_device_id == dev_a.id, TopologyEdge.target_device_id == dev_b.id).all()
    print(f"Edges A->B: {len(edges)}")
    for e in edges:
        print(f"  Edge: {e.relationship_type}, active={e.is_active}, src={e.edge_source}")

    # 3. Simulate Traffic Ingestion from dev_a to dev_b
    from app.schemas.traffic import ICSTrafficIn
    from app.api.routes.traffic import ingest_traffic
    import builtins
    
    # Mock current_user dependency
    class MockUser:
        id = user.id
    
    payload = ICSTrafficIn(
        source_ip="192.168.100.10",
        destination_ip="192.168.100.20",
        transport_protocol="tcp",
        source_port=50000,
        destination_port=502,
        packet_count=50,
        bytes_in=1000,
        bytes_out=500,
        duration_ms=100,
        payload_entropy=0.0
    )
    
    print("Ingesting traffic A -> B")
    ingest_traffic(payload=payload, db=db, current_user=MockUser())
    db.commit()

    # 4. Verify BOTH devices were touched
    db.refresh(dev_a)
    db.refresh(dev_b)
    print(f"Dev A status: {dev_a.monitoring_status}, last_traffic_at: {dev_a.last_traffic_at}")
    print(f"Dev B status: {dev_b.monitoring_status}, last_traffic_at: {dev_b.last_traffic_at}")

if __name__ == "__main__":
    main()
