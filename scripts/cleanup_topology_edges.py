import os
import sys

# Add backend to path so we can import app modules
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.append(backend_dir)

from app.db.session import SessionLocal
from app.models.topology_edge import TopologyEdge
from app.services.topology import backfill_topology_from_traffic

def cleanup():
    db = SessionLocal()
    try:
        # Step 1: Zero out all inflated edges
        edges = db.query(TopologyEdge).all()
        print(f"Found {len(edges)} topology edges to clean.")
        print("-" * 40)
        for edge in edges:
            print(f"Edge {edge.id} [Before]: packet_count={edge.packet_count}, bytes_total={edge.bytes_total}")
            edge.packet_count = 0
            edge.bytes_total = 0
            
            # Wipe the processed list so backfill will process them again
            if isinstance(edge.metadata_json, dict) and "processed_record_ids" in edge.metadata_json:
                merged = dict(edge.metadata_json)
                merged["processed_record_ids"] = []
                edge.metadata_json = merged
                
            db.add(edge)
        
        db.commit()
        print("-" * 40)
        print("Cleared all edge counters and processed_record_ids.")
        
        # Step 2: Re-run the backfill to build accurate counts using the idempotent logic
        print("Running backfill to rebuild counts correctly...")
        # 168 hours = 7 days (the standard max historical window)
        n = backfill_topology_from_traffic(db, tenant_ids=None, hours=168)
        db.commit()
        print(f"Backfill complete. Processed {n} traffic records.")
        
        # Step 3: Print after state
        print("-" * 40)
        edges = db.query(TopologyEdge).all()
        for edge in edges:
            print(f"Edge {edge.id} [After] : packet_count={edge.packet_count}, bytes_total={edge.bytes_total}")
            
    except Exception as e:
        print(f"Error during cleanup: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup()
