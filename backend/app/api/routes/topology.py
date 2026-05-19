from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.db.session import get_db
from app.models.device import Device
from app.models.topology_edge import TopologyEdge, TopologyEdgeSource
from app.models.user import User
from app.schemas.topology import (
    TopologyBackfillResponse,
    TopologyEdgeCreate,
    TopologyEdgeResponse,
    TopologySnapshotResponse,
)
from app.services.tenant import get_accessible_tenant_ids
from app.services.topology import (
    _serialize_edge,
    backfill_topology_from_traffic,
    build_topology_snapshot,
    devices_query_for_user,
    edges_query_for_user,
    sync_metadata_edges_for_device,
    _upsert_edge,
)

router = APIRouter(prefix="/topology", tags=["topology"])


@router.get("/snapshot", response_model=TopologySnapshotResponse)
def topology_snapshot(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("view_traffic")),
    tenant_id: int | None = Query(default=None),
) -> TopologySnapshotResponse:
    payload = build_topology_snapshot(db, current_user, tenant_id)
    db.commit()
    return TopologySnapshotResponse(**payload)


@router.get("/edges", response_model=list[TopologyEdgeResponse])
def list_topology_edges(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("view_traffic")),
    tenant_id: int | None = Query(default=None),
    active_only: bool = Query(False),
) -> list[TopologyEdgeResponse]:
    q = edges_query_for_user(db, current_user, tenant_id)
    if active_only:
        q = q.filter(TopologyEdge.is_active.is_(True))
    edges = q.order_by(TopologyEdge.last_seen_at.desc().nullslast()).all()
    devices = {d.id: d for d in devices_query_for_user(db, current_user, tenant_id).all()}
    return [TopologyEdgeResponse(**_serialize_edge(e, devices)) for e in edges]


@router.post("/edges", response_model=TopologyEdgeResponse, status_code=status.HTTP_201_CREATED)
def create_topology_edge(
    payload: TopologyEdgeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("edit_devices")),
    tenant_id: int | None = Query(default=None),
) -> TopologyEdgeResponse:
    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)
    for device_id in (payload.source_device_id, payload.target_device_id):
        q = db.query(Device).filter(Device.id == device_id)
        if tenant_ids is not None:
            q = q.filter(Device.user_id.in_(tenant_ids))
        if q.first() is None:
            raise HTTPException(status_code=404, detail=f"Device {device_id} not found")

    edge = _upsert_edge(
        db,
        user_id=current_user.id,
        source_id=payload.source_device_id,
        target_id=payload.target_device_id,
        relationship_type=payload.relationship_type.value,
        direction=payload.direction.value,
        edge_source=TopologyEdgeSource.manual.value,
        protocol_context=payload.protocol_context,
        metadata=payload.metadata_json,
    )
    db.commit()
    db.refresh(edge)
    devices = {d.id: d for d in devices_query_for_user(db, current_user, tenant_id).all()}
    return TopologyEdgeResponse(**_serialize_edge(edge, devices))


@router.get("/edges/device/{device_id}", response_model=list[TopologyEdgeResponse])
def get_device_edges(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("view_traffic")),
    tenant_id: int | None = Query(default=None),
) -> list[TopologyEdgeResponse]:
    """Return all topology edges where the given device is the source or target."""
    # Verify the device is accessible by this user
    dev_q = db.query(Device).filter(Device.id == device_id)
    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)
    if tenant_ids is not None:
        dev_q = dev_q.filter(Device.user_id.in_(tenant_ids))
    if dev_q.first() is None:
        raise HTTPException(status_code=404, detail="Device not found")

    q = edges_query_for_user(db, current_user, tenant_id).filter(
        or_(
            TopologyEdge.source_device_id == device_id,
            TopologyEdge.target_device_id == device_id,
        )
    )
    edges = q.order_by(TopologyEdge.created_at.asc()).all()
    devices = {d.id: d for d in devices_query_for_user(db, current_user, tenant_id).all()}
    return [TopologyEdgeResponse(**_serialize_edge(e, devices)) for e in edges]


@router.delete("/edges/{edge_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topology_edge(
    edge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("edit_devices")),
    tenant_id: int | None = Query(default=None),
) -> None:
    """Hard-delete a topology edge. Only the edge owner (or admin) can delete it."""
    q = db.query(TopologyEdge).filter(TopologyEdge.id == edge_id)
    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)
    if tenant_ids is not None:
        q = q.filter(TopologyEdge.user_id.in_(tenant_ids))
    edge = q.first()
    if edge is None:
        raise HTTPException(status_code=404, detail="Edge not found")
    db.delete(edge)
    db.commit()
    return None


@router.post("/sync-metadata", response_model=TopologyBackfillResponse)
def sync_all_metadata_edges(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("edit_devices")),
    tenant_id: int | None = Query(default=None),
) -> TopologyBackfillResponse:
    devices = devices_query_for_user(db, current_user, tenant_id).all()
    total = 0
    for device in devices:
        total += sync_metadata_edges_for_device(db, device)
    db.commit()
    return TopologyBackfillResponse(traffic_edges_upserted=total)


@router.post("/backfill-traffic", response_model=TopologyBackfillResponse)
def backfill_traffic_edges(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("edit_devices")),
    tenant_id: int | None = Query(default=None),
    hours: int = Query(168, ge=1, le=720),
) -> TopologyBackfillResponse:
    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)
    n = backfill_topology_from_traffic(
        db,
        tenant_ids=tenant_ids,
        hours=hours,
    )
    db.commit()
    return TopologyBackfillResponse(traffic_edges_upserted=n)
