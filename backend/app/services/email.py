import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _build_action_link(base_url: str, path: str, token: str) -> str | None:
    if not base_url:
        return None
    base = base_url.rstrip("/")
    url_path = path if path.startswith("/") else f"/{path}"
    return f"{base}{url_path}?token={token}"


def _build_sender(from_email: str, from_name: str) -> str:
    if from_name:
        return f"{from_name} <{from_email}>"
    return from_email


def _email_enabled(settings) -> bool:
    return bool(settings.email_enabled and settings.smtp_host and settings.smtp_from_email)


def send_email(to_email: str, subject: str, body: str, html_body: str | None = None) -> bool:
    settings = get_settings()
    if not _email_enabled(settings):
        logger.info("Email delivery disabled or not configured")
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = _build_sender(settings.smtp_from_email, settings.smtp_from_name)
    message["To"] = to_email
    message.set_content(body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    try:
        if settings.smtp_use_ssl:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(
                settings.smtp_host,
                settings.smtp_port,
                timeout=settings.smtp_timeout_seconds,
                context=context,
            ) as client:
                if settings.smtp_username:
                    client.login(settings.smtp_username, settings.smtp_password or "")
                client.send_message(message)
        else:
            with smtplib.SMTP(
                settings.smtp_host,
                settings.smtp_port,
                timeout=settings.smtp_timeout_seconds,
            ) as client:
                if settings.smtp_use_tls:
                    context = ssl.create_default_context()
                    client.starttls(context=context)
                if settings.smtp_username:
                    client.login(settings.smtp_username, settings.smtp_password or "")
                client.send_message(message)
        return True
    except Exception:
        logger.exception("Email delivery failed")
        return False


def send_verification_email(to_email: str, token: str) -> bool:
    settings = get_settings()
    link = _build_action_link(settings.frontend_base_url, settings.email_verification_path, token)
    subject = "Verify your email"
    lines = [
        "Use the verification token below to confirm your email address.",
        f"Token: {token}",
    ]
    if link:
        lines.append(f"Link: {link}")
    lines.append("If you did not request this, you can ignore this email.")
    return send_email(to_email, subject, "\n".join(lines))


def send_password_reset_email(to_email: str, token: str) -> bool:
    settings = get_settings()
    link = _build_action_link(settings.frontend_base_url, settings.password_reset_path, token)
    subject = "Reset your password"
    lines = [
        "Use the reset token below to change your password.",
        f"Token: {token}",
    ]
    if link:
        lines.append(f"Link: {link}")
    lines.append("If you did not request this, you can ignore this email.")
    return send_email(to_email, subject, "\n".join(lines))
