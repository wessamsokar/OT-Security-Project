import os
import sys

# Add the parent directory to sys.path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.device import Device
from app.models.user import User, UserRole
from app.core.security import get_password_hash

def main():
    db = SessionLocal()
    try:
        # Find admins
        admins = db.query(User).filter(User.role == UserRole.admin).all()
        admin_ids = [a.id for a in admins]
        
        if not admin_ids:
            print("No admins found.")
            return

        # Find orphan devices (owned by admins)
        orphan_devices = db.query(Device).filter(Device.user_id.in_(admin_ids)).all()
        
        if not orphan_devices:
            print("No orphan devices found. Migration complete.")
            return
            
        print(f"Found {len(orphan_devices)} orphan devices owned by admins.")
        
        # Check if 'Unassigned' customer exists
        unassigned = db.query(User).filter(User.username == "unassigned").first()
        if not unassigned:
            print("Creating 'Unassigned' customer...")
            unassigned = User(
                username="unassigned",
                email="unassigned@localhost",
                hashed_password=get_password_hash("password123"),  # dummy password
                role=UserRole.customer,
                company_name="Unassigned Environment",
                is_active=True,
            )
            db.add(unassigned)
            db.commit()
            db.refresh(unassigned)
            
        print(f"Assigning devices to 'Unassigned' (ID: {unassigned.id})...")
        for device in orphan_devices:
            print(f"  - Device: {device.name} (ID: {device.id})")
            device.user_id = unassigned.id
            
        db.commit()
        print("Migration complete. All orphan devices are now assigned to the 'Unassigned' customer.")
        
    except Exception as e:
        db.rollback()
        print(f"Error during migration: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
