from fastapi import APIRouter

from app.api.routes import alerts, auth, health, model, stream, traffic

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(traffic.router)
api_router.include_router(alerts.router)
api_router.include_router(model.router)
api_router.include_router(stream.router)

health_router = APIRouter()
health_router.include_router(health.router)
