from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User, UserCustomerAssignment, UserRole
from app.services.permissions import user_is_admin


def get_accessible_tenant_ids(
    db: Session, user: User, requested_tenant_id: int | None = None
) -> list[int] | None:
    """
    Determine the allowed customer (tenant) IDs the user can access.
    - Admin: Returns None (can access all data).
    - Analyst/Viewer: Returns assigned customer IDs. Filters down to requested_tenant_id if provided.
      Returns [-1] if no assignments exist to safely return zero records.
    - Customer: Returns [user.id].
    """
    if user_is_admin(user):
        # Admins can see everything, or filter to a specific tenant if requested
        if requested_tenant_id is not None:
            return [requested_tenant_id]
        return None

    if user.role in (UserRole.analyst, UserRole.viewer):
        assignments = (
            db.query(UserCustomerAssignment.customer_user_id)
            .filter(UserCustomerAssignment.assigned_user_id == user.id)
            .all()
        )
        allowed_ids = [row[0] for row in assignments]

        if not allowed_ids:
            return [-1]  # Safely match nothing

        if requested_tenant_id is not None:
            if requested_tenant_id not in allowed_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not assigned to this customer tenant.",
                )
            return [requested_tenant_id]
        
        return allowed_ids

    # For 'customer' (or any other unspecified role), they are their own tenant.
    if requested_tenant_id is not None and requested_tenant_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access other customer tenants.",
        )
    
    return [user.id]
