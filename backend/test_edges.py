from app.db.session import SessionLocal
from app.models.device import Device
from app.models.user import User
from app.models.topology_edge import TopologyEdge
from app.services.topology import sync_metadata_edges_for_device

db = SessionLocal()
user = db.query(User).first()
if user:
    device1 = Device(user_id=user.id, name="D1", device_type="plc", metadata_json={})
    device2 = Device(user_id=user.id, name="D2", device_type="hmi", metadata_json={})
    db.add(device1)
    db.add(device2)
    db.flush()

    device2.metadata_json = {"connected_device_id": device1.id}
    db.flush()
    sync_metadata_edges_for_device(db, device2)
    db.commit()

    edges = db.query(TopologyEdge).filter(TopologyEdge.user_id == user.id).all()
    for e in edges:
        print(f"Edge: {e.source_device_id} -> {e.target_device_id}, type={e.relationship_type}, active={e.is_active}, source={e.edge_source}")
db.close()
