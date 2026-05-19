from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserRole(str, Enum):
    admin = "admin"
    customer = "customer"
    analyst = "analyst"
    viewer = "viewer"


class OnboardingStatus(str, Enum):
    """Self-service registration lifecycle; admins approve or reject after review."""
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class IndustryType(str, Enum):
    power_distribution = "power_distribution"
    smart_grid = "smart_grid"
    industrial_automation = "industrial_automation"
    manufacturing = "manufacturing"
    other = "other"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SqlEnum(UserRole), nullable=False, default=UserRole.customer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Kept in sync with onboarding_status for legacy checks and admin UI toggles.
    is_admin_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    admin_approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # ─── OT onboarding / organization profile (filled at self-registration) ───
    onboarding_status: Mapped[OnboardingStatus] = mapped_column(
        SqlEnum(
            OnboardingStatus,
            values_callable=lambda e: [m.value for m in e],
            native_enum=False,
            length=16,
        ),
        default=OnboardingStatus.approved,
        nullable=False,
    )
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(180), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    industry_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    infrastructure_type: Mapped[str | None] = mapped_column(String(180), nullable=True)
    estimated_device_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    country: Mapped[str | None] = mapped_column(String(80), nullable=True)
    purpose_of_access: Mapped[str | None] = mapped_column(Text, nullable=True)
    operates_ot_ics: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    roles = relationship("Role", secondary="user_roles", back_populates="users")
    devices = relationship("Device", back_populates="owner", cascade="all, delete-orphan")

class UserCustomerAssignment(Base):
    """
    Many-to-many relationship scoping Analyst/Viewer users to Customer users.
    An analyst/viewer will only see data belonging to their assigned customers.
    """
    __tablename__ = "user_customer_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    assigned_user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    customer_user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
