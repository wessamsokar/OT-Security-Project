from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.db.session import get_db
from app.models.model_version import ModelVersion
from app.models.user import User, UserRole
from app.schemas.model import ModelVersionResponse, RetrainResponse
from app.tasks.retrain_task import retrain_model_task

router = APIRouter(prefix="/model", tags=["model"])


@router.post("/retrain", response_model=RetrainResponse)
def retrain_model(current_user: User = Depends(require_roles(UserRole.admin))) -> RetrainResponse:
    task = retrain_model_task.delay(triggered_by=current_user.username)
    return RetrainResponse(task_id=task.id, status="queued")


@router.get("/versions", response_model=list[ModelVersionResponse])
def list_versions(
    db: Session = Depends(get_db),
    _user=Depends(require_roles(UserRole.admin, UserRole.analyst, UserRole.viewer)),
) -> list[ModelVersionResponse]:
    return db.query(ModelVersion).order_by(ModelVersion.created_at.desc()).all()
