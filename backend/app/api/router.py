from fastapi import APIRouter

from app.api.routes import alerts, audit, auth, capture, devices, health, model, public, rbac, stream, topology, traffic, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(rbac.router)
api_router.include_router(users.router)
api_router.include_router(devices.router)
api_router.include_router(capture.router)
api_router.include_router(traffic.router)
api_router.include_router(topology.router)
api_router.include_router(alerts.router)
api_router.include_router(model.router)
api_router.include_router(stream.router)
api_router.include_router(public.router)
api_router.include_router(audit.router)

health_router = APIRouter()
health_router.include_router(health.router)
