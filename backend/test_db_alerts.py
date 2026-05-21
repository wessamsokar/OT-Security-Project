from app.db.session import SessionLocal
from app.models.alert import Alert

db = SessionLocal()
alerts = db.query(Alert).all()
for a in alerts[-10:]:
    print(f"Alert {a.id}: sev={a.severity.value}, summary={a.summary}")
db.close()
