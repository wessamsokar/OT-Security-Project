import logging
from celery import shared_task
import redis
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.session import SessionLocal
from app.core.config import get_settings
from app.models.alert import Alert
from app.models.device import Device
from app.models.user import User, UserRole, UserCustomerAssignment
from app.services.email import send_email, _build_branded_email, _render_security_notice

logger = logging.getLogger(__name__)

def _get_redis_client():
    settings = get_settings()
    return redis.Redis.from_url(settings.redis_url)

def resolve_alert_recipients(db: Session, customer_user_id: int, severity: str) -> list[str]:
    """
    Resolve emails for:
    1. The customer themselves.
    2. Any analysts/viewers assigned to this customer.
    3. Admins (if severity is HIGH/CRITICAL).
    """
    emails = set()
    
    # 1. Customer
    customer = db.query(User).filter(User.id == customer_user_id, User.is_active == True).first()
    if customer:
        emails.add(customer.email)
        
    # 2. Assigned Analysts/Viewers
    assignments = db.query(UserCustomerAssignment.assigned_user_id).filter(
        UserCustomerAssignment.customer_user_id == customer_user_id
    ).all()
    assigned_ids = [row[0] for row in assignments]
    if assigned_ids:
        assigned_users = db.query(User).filter(User.id.in_(assigned_ids), User.is_active == True).all()
        for u in assigned_users:
            emails.add(u.email)
            
    # 3. Admins (if HIGH or CRITICAL)
    if severity.upper() in ("HIGH", "CRITICAL"):
        admins = db.query(User).filter(User.role == UserRole.admin, User.is_active == True).all()
        for u in admins:
            emails.add(u.email)
            
    return list(emails)

def _dispatch_email(alert: Alert, device: Device, customer: User, recipients: list[str]):
    settings = get_settings()
    brand = settings.smtp_from_name.strip() or settings.app_name.strip() or "ICS Guard"
    
    severity_upper = (alert.severity or "UNKNOWN").upper()
    is_critical = severity_upper == "CRITICAL"
    
    subject = f"[{severity_upper}] OT Alert: {alert.attack_type} on {device.name}"
    
    customer_label = customer.company_name or customer.username
    
    # Build a nice email body
    color = "#f87171" if not is_critical else "#ef4444"
    bg_warning = f"<div style=\"padding:12px; border-left:4px solid {color}; background:rgba(255,255,255,0.05); margin-bottom:16px;\">"
    
    body_sections = [
        f"{bg_warning}<h2 style=\"margin:0; font-size:16px; color:{color};\">{alert.attack_type}</h2>",
        f"<p style=\"margin:8px 0 0 0; font-size:14px; color:#e2ecff;\">A {severity_upper} severity alert was generated for your environment.</p></div>",
        f"<p><strong>Environment:</strong> {customer_label}</p>",
        f"<p><strong>Device:</strong> {device.name} ({device.ip_address or 'Unknown IP'})</p>",
        f"<p><strong>Status:</strong> {device.operational_state}</p>",
        f"<p><strong>Time:</strong> {alert.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}</p>",
        f"<p><strong>Recommended Action:</strong> {alert.recommended_action or 'Investigate device behavior and verify topology context.'}</p>",
    ]
    
    html_body = _build_branded_email(
        brand_title=brand,
        headline=f"OT Alert: {alert.attack_type}",
        lead="Immediate attention may be required.",
        body_sections=body_sections,
        footer_text="Industrial OT Security Alert Notification.",
        preheader=f"Alert: {alert.attack_type} on {device.name}",
    )
    
    plain_text = (
        f"OT Alert: {alert.attack_type}\n"
        f"Severity: {severity_upper}\n"
        f"Device: {device.name}\n"
        f"Environment: {customer_label}\n"
        f"Recommended: {alert.recommended_action}"
    )
    
    for email in recipients:
        try:
            send_email(email, subject, plain_text, html_body)
        except Exception as e:
            logger.error(f"Failed to send alert email to {email}: {e}")

@shared_task
def send_alert_notification_task(alert_id: int):
    """
    Provider-agnostic entry point for alert notifications.
    Currently routes to Email if conditions are met.
    Can be expanded to Slack, Teams, SMS, Webhooks.
    """
    db = SessionLocal()
    try:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            logger.error(f"Notification task failed: Alert {alert_id} not found.")
            return

        device = db.query(Device).filter(Device.id == alert.device_id).first()
        if not device:
            logger.error(f"Notification task failed: Device {alert.device_id} not found.")
            return
            
        severity = (alert.severity or "low").lower()
        
        # 1. Severity Gate
        if severity in ("low", "medium"):
            # Do NOT send immediate emails for MEDIUM at this stage
            return
            
        # 2. Anti-spam Cooldown
        # Cooldown per (device_id, attack_type)
        redis_client = _get_redis_client()
        cooldown_key = f"alert_cooldown:{device.id}:{alert.attack_type}"
        
        # 15 minutes = 900 seconds
        acquired = redis_client.set(cooldown_key, "1", ex=900, nx=True)
        if not acquired:
            logger.info(f"Notification skipped due to cooldown: {cooldown_key}")
            return
            
        # 3. Resolve Recipients
        recipients = resolve_alert_recipients(db, device.user_id, severity)
        if not recipients:
            logger.info(f"No recipients resolved for alert {alert_id}")
            return
            
        customer = db.query(User).filter(User.id == device.user_id).first()
        
        # 4. Dispatch Email
        _dispatch_email(alert, device, customer, recipients)
        
        # Future integrations (Slack, Webhooks) would be dispatched here.
        
    except Exception as e:
        logger.error(f"Error in send_alert_notification_task: {e}")
    finally:
        db.close()
