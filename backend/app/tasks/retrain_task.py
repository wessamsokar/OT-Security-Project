import asyncio
import uuid

from celery import shared_task
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.model_version import ModelVersion
from app.services.ml_client import trigger_retrain


@shared_task(name="retrain_model")
def retrain_model_task(triggered_by: str = "system") -> dict:
    retrain_job_id = str(uuid.uuid4())
    result = asyncio.run(trigger_retrain({"triggered_by": triggered_by, "retrain_job_id": retrain_job_id}))

    db: Session = SessionLocal()
    try:
        db.query(ModelVersion).update({ModelVersion.is_active: False})
        version = ModelVersion(
            version=result["model_version"],
            label=result.get("label", "Retrained model"),
            metrics_json=result.get("metrics", {}),
            trained_by=triggered_by,
            retrain_job_id=retrain_job_id,
            is_active=True,
        )
        db.add(version)
        db.commit()
        db.refresh(version)
    finally:
        db.close()

    return {
        "task_status": "completed",
        "retrain_job_id": retrain_job_id,
        "model_version": result["model_version"],
    }
