import html
import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Matches frontend :root theme (dark OT dashboard)
_THEME_BG = "#060c1c"
_THEME_PANEL = "#0d1734"
_THEME_BRAND = "#5d9cff"
_THEME_TEXT = "#e2ecff"
_THEME_MUTED = "#90a1c4"
_THEME_ACCENT = "#25c7b0"
_THEME_PURPLE = "#b794f6"
_THEME_PURPLE_DEEP = "#7c3aed"
_THEME_BORDER = "rgba(93, 156, 255, 0.22)"


def _build_action_link(base_url: str, path: str, token: str) -> str | None:
    if not base_url:
        return None
    base = base_url.rstrip("/")
    url_path = path if path.startswith("/") else f"/{path}"
    return f"{base}{url_path}?token={token}"


def _frontend_login_url() -> str | None:
    settings = get_settings()
    base = (settings.frontend_base_url or "").strip().rstrip("/")
    if not base:
        return None
    return f"{base}/login"


def _build_sender(from_email: str, from_name: str) -> str:
    if from_name:
        return f"{from_name} <{from_email}>"
    return from_email


def _email_enabled(settings) -> bool:
    return bool(settings.email_enabled and settings.smtp_host and settings.smtp_from_email)


def _escape(s: str) -> str:
    return html.escape(s, quote=True)


def _html_email_shell(
    *,
    brand_title: str,
    headline: str,
    lead: str,
    cta_label: str | None,
    action_url: str | None,
    footer_extra: str,
    brand_tag_color: str | None = None,
    cta_gradient: str | None = None,
    footer_signature_color: str | None = None,
    button_tip: str | None = None,
) -> str:
    """Single-column HTML suitable for mail clients (inline styles, table layout)."""
    brand_safe = _escape(brand_title)
    headline_safe = _escape(headline)
    lead_safe = _escape(lead).replace("\n", "<br />")
    tag_color = brand_tag_color or _THEME_BRAND
    btn_grad = cta_gradient or f"linear-gradient(135deg,{_THEME_BRAND} 0%,#4a7fd9 100%)"
    sig_color = footer_signature_color or _THEME_ACCENT
    tip_default = "Tip: use the button above — the secure link is not shown here as plain text."
    tip_html = _escape(button_tip if button_tip is not None else tip_default)

    if action_url and cta_label:
        cta_safe = _escape(cta_label)
        url_safe = html.escape(action_url, quote=True)
        button_block = f"""
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0 0;">
          <tr>
            <td align="center" style="border-radius:12px;background:{btn_grad};">
              <a href="{url_safe}" target="_blank" rel="noopener noreferrer"
                 style="display:inline-block;padding:14px 28px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#060c1c;text-decoration:none;border-radius:12px;">
                {cta_safe}
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0 0;font-size:12px;line-height:1.5;color:{_THEME_MUTED};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
          {tip_html}
        </p>
        """
    else:
        button_block = f"""
        <div style="margin:24px 0;padding:16px 18px;border-radius:12px;border:1px solid {_THEME_BORDER};background:rgba(13,23,52,0.9);">
          <p style="margin:0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.55;color:{_THEME_MUTED};">
            {_escape(footer_extra)}
          </p>
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:{_THEME_BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{_THEME_BG};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:{_THEME_PANEL};border-radius:20px;border:1px solid {_THEME_BORDER};overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 8px 28px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:{tag_color};">{brand_safe}</p>
              <h1 style="margin:0 0 14px 0;font-size:22px;font-weight:600;color:{_THEME_TEXT};line-height:1.25;">{headline_safe}</h1>
              <p style="margin:0;font-size:15px;line-height:1.6;color:{_THEME_MUTED};">{lead_safe}</p>
              {button_block}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 28px 28px;border-top:1px solid {_THEME_BORDER};">
              <p style="margin:0;font-size:12px;line-height:1.5;color:{_THEME_MUTED};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
                {_escape("Industrial OT security · If you did not request this message, you can safely ignore it.")}
              </p>
              <p style="margin:14px 0 0 0;font-size:11px;color:{sig_color};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">{_escape("— OT Sentinel")}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def _format_delivery_error(exc: BaseException) -> str:
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        err = getattr(exc, "smtp_error", b"") or b""
        if isinstance(err, bytes):
            try:
                err_s = err.decode(errors="replace")
            except Exception:
                err_s = str(err)
        else:
            err_s = str(err)
        code = getattr(exc, "smtp_code", "?")
        return f"SMTP auth failed ({code} {err_s.strip()})."
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        return "SMTP server refused recipient address."
    if isinstance(exc, (TimeoutError, OSError)):
        return f"SMTP connection failed: {type(exc).__name__}: {exc}"
    if isinstance(exc, smtplib.SMTPException):
        msg = getattr(exc, "smtp_error", None)
        code = getattr(exc, "smtp_code", None)
        if isinstance(msg, bytes):
            msg = msg.decode(errors="replace")
        bits = [type(exc).__name__]
        if code is not None:
            bits.append(str(code))
        if msg:
            bits.append(str(msg).strip())
        return ": ".join(bits)[:500]
    return f"{type(exc).__name__}: {exc}"[:500]


def _send_over_session(settings, message: EmailMessage) -> None:
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
        return

    context = ssl.create_default_context()
    with smtplib.SMTP(
        settings.smtp_host,
        settings.smtp_port,
        timeout=settings.smtp_timeout_seconds,
    ) as client:
        client.ehlo()
        if settings.smtp_use_tls:
            client.starttls(context=context)
            client.ehlo()
        if settings.smtp_username:
            client.login(settings.smtp_username, settings.smtp_password or "")
        client.send_message(message)


def send_email(to_email: str, subject: str, body: str, html_body: str | None = None) -> tuple[bool, str | None]:
    settings = get_settings()
    if not _email_enabled(settings):
        diag = "Email delivery disabled or not configured."
        logger.info(diag)
        return False, diag

    email_msg = EmailMessage()
    email_msg["Subject"] = subject
    email_msg["From"] = _build_sender(settings.smtp_from_email, settings.smtp_from_name)
    email_msg["To"] = to_email
    email_msg.set_content(body)
    if html_body:
        email_msg.add_alternative(html_body, subtype="html")

    fallback_err: str | None = None
    try:
        _send_over_session(settings, email_msg)
        return True, None
    except Exception as primary_exc:
        err_primary = _format_delivery_error(primary_exc)
        gmail_fallback = (
            settings.smtp_host.strip().lower() == "smtp.gmail.com"
            and settings.smtp_port == 587
            and settings.smtp_use_tls
            and not settings.smtp_use_ssl
            and settings.smtp_username
        )
        if gmail_fallback:
            try:
                fallback_ctx = ssl.create_default_context()
                with smtplib.SMTP_SSL(
                    "smtp.gmail.com",
                    465,
                    timeout=settings.smtp_timeout_seconds,
                    context=fallback_ctx,
                ) as client:
                    client.login(settings.smtp_username, settings.smtp_password or "")
                    client.send_message(email_msg)
                logger.info("SMTP: primary path failed (%s); delivered via Gmail port 465 fallback.", err_primary)
                return True, None
            except Exception as fb_exc:
                fallback_err = _format_delivery_error(fb_exc)
                logger.error("SMTP Gmail fallback on 465 failed", exc_info=fb_exc)

        logger.error("Email delivery failed: %s", err_primary, exc_info=primary_exc)
        diag = err_primary if not fallback_err else f"{err_primary} | 465: {fallback_err}"
        return False, diag[:800]


def send_verification_email(to_email: str, token: str) -> tuple[bool, str | None]:
    settings = get_settings()
    brand = settings.smtp_from_name.strip() or settings.app_name.strip() or "ICS Guard"
    link = _build_action_link(settings.frontend_base_url, settings.email_verification_path, token)
    subject = f"{brand} — Verify your email"

    if link:
        plain = (
            f"{brand}\n\n"
            "Confirm your email address using the secure link below.\n"
            "We never display security tokens in this message — only the button and link contain your one-time access.\n\n"
            f"{link}\n\n"
            "If you did not create an account, you can ignore this email."
        )
        html_body = _html_email_shell(
            brand_title=brand,
            headline="Confirm your email",
            lead="Welcome aboard. Tap the button below to verify your address and activate your account.",
            cta_label="Verify email",
            action_url=link,
            footer_extra="",
        )
    else:
        missing = (
            "Email links are disabled until FRONTEND_BASE_URL is configured on the server. "
            "Ask your administrator to set it so verification links can be sent."
        )
        plain = f"{brand}\n\n{missing}\n\nIf you did not create an account, ignore this email."
        html_body = _html_email_shell(
            brand_title=brand,
            headline="Confirm your email",
            lead="We could not build a verification link because the application URL is not configured.",
            cta_label=None,
            action_url=None,
            footer_extra=missing,
        )

    return send_email(to_email, subject, plain, html_body)


def send_email_verified_by_admin_notice(to_email: str, display_name: str) -> tuple[bool, str | None]:
    """Notify user that an admin marked their email as verified (dark blue + purple theme)."""
    settings = get_settings()
    brand = settings.smtp_from_name.strip() or settings.app_name.strip() or "ICS Guard"
    name = (display_name or "").strip() or "there"
    subject = f"{brand} — Your email is verified"
    login_url = _frontend_login_url()

    if login_url:
        plain = (
            f"{brand}\n\n"
            f"Hello {name},\n\n"
            "An administrator has verified your email address for your account.\n"
            "You can sign in with your usual credentials.\n\n"
            f"{login_url}\n\n"
            "— OT Sentinel"
        )
        html_body = _html_email_shell(
            brand_title=brand,
            headline="Your email is verified",
            lead=(
                f"Hi {name}, an administrator has confirmed your email address. "
                "Your account email is now verified on the platform."
            ),
            cta_label="Sign in",
            action_url=login_url,
            footer_extra="",
            brand_tag_color=_THEME_PURPLE,
            cta_gradient=f"linear-gradient(135deg,{_THEME_BRAND} 0%,{_THEME_PURPLE_DEEP} 100%)",
            footer_signature_color=_THEME_PURPLE,
            button_tip="Use the button above to open the sign-in page.",
        )
    else:
        extra = (
            "Your email is verified. Open your organization’s OT Sentinel sign-in page in the browser. "
            "Ask your administrator to set FRONTEND_BASE_URL on the server for direct links in future emails."
        )
        plain = f"{brand}\n\nHello {name},\n\n{extra}\n\n— OT Sentinel"
        html_body = _html_email_shell(
            brand_title=brand,
            headline="Your email is verified",
            lead=f"Hi {name}, an administrator has confirmed your email address. {extra}",
            cta_label=None,
            action_url=None,
            footer_extra=extra,
            brand_tag_color=_THEME_PURPLE,
            cta_gradient=None,
            footer_signature_color=_THEME_PURPLE,
        )

    return send_email(to_email, subject, plain, html_body)


def send_account_approved_by_admin_notice(to_email: str, display_name: str) -> tuple[bool, str | None]:
    """Notify user that an admin approved their account (can sign in). Same visual theme as verify email."""
    settings = get_settings()
    brand = settings.smtp_from_name.strip() or settings.app_name.strip() or "ICS Guard"
    name = (display_name or "").strip() or "there"
    subject = f"{brand} — Your account is approved"
    login_url = _frontend_login_url()

    if login_url:
        plain = (
            f"{brand}\n\n"
            f"Hello {name},\n\n"
            "An administrator has approved your account. You can sign in to the OT Sentinel workspace.\n\n"
            f"{login_url}\n\n"
            "— OT Sentinel"
        )
        html_body = _html_email_shell(
            brand_title=brand,
            headline="Your account is approved",
            lead=(
                f"Hi {name}, your account has been approved by an administrator. "
                "You may sign in with your email and password."
            ),
            cta_label="Sign in",
            action_url=login_url,
            footer_extra="",
            brand_tag_color=_THEME_PURPLE,
            cta_gradient=f"linear-gradient(135deg,{_THEME_BRAND} 0%,{_THEME_PURPLE_DEEP} 100%)",
            footer_signature_color=_THEME_PURPLE,
            button_tip="Use the button above to open the sign-in page.",
        )
    else:
        extra = (
            "Your account is approved. Open your organization’s OT Sentinel sign-in page. "
            "Configure FRONTEND_BASE_URL for direct sign-in links in future emails."
        )
        plain = f"{brand}\n\nHello {name},\n\n{extra}\n\n— OT Sentinel"
        html_body = _html_email_shell(
            brand_title=brand,
            headline="Your account is approved",
            lead=f"Hi {name}, {extra}",
            cta_label=None,
            action_url=None,
            footer_extra=extra,
            brand_tag_color=_THEME_PURPLE,
            cta_gradient=None,
            footer_signature_color=_THEME_PURPLE,
        )

    return send_email(to_email, subject, plain, html_body)


def send_ot_onboarding_approved_email(
    to_email: str,
    contact_name: str,
    company_name: str,
) -> tuple[bool, str | None]:
    """Welcome email after OT access request is approved (enterprise / OT Sentinel theme)."""
    settings = get_settings()
    brand = settings.smtp_from_name.strip() or settings.app_name.strip() or "ICS Guard"
    who = (contact_name or "").strip() or "there"
    org = (company_name or "").strip() or "your organization"
    subject = f"{brand} — Access approved for {org}"
    login_url = _frontend_login_url()

    lead = (
        f"We are pleased to confirm that {org}’s access request for the OT Sentinel platform has been approved. "
        f"You ({who}) may now sign in using the work email registered with us and your chosen password."
    )

    if login_url:
        plain = (
            f"{brand}\n\n"
            f"Hello {who},\n\n"
            f"{lead}\n\n"
            f"Sign in: {login_url}\n\n"
            "For security, use only approved corporate devices and networks when accessing ICS monitoring data.\n\n"
            "— OT Sentinel"
        )
        html_body = _html_email_shell(
            brand_title=brand,
            headline="Your access request was approved",
            lead=lead,
            cta_label="Access OT Sentinel",
            action_url=login_url,
            footer_extra="Use your work email and password. Contact your SOC lead if MFA or SSO applies in your tenancy.",
            brand_tag_color=_THEME_PURPLE,
            cta_gradient=f"linear-gradient(135deg,{_THEME_BRAND} 0%,{_THEME_PURPLE_DEEP} 100%)",
            footer_signature_color=_THEME_PURPLE,
            button_tip="Secure sign-in opens in your browser.",
        )
    else:
        extra = (
            "Sign-in URL is configured by your administrator. Open your organization OT Sentinel gateway in the browser. "
            "Set FRONTEND_BASE_URL on the server to include direct links in outbound mail."
        )
        plain = f"{brand}\n\nHello {who},\n\n{lead}\n\n{extra}\n\n— OT Sentinel"
        html_body = _html_email_shell(
            brand_title=brand,
            headline="Your access request was approved",
            lead=f"{lead} {extra}",
            cta_label=None,
            action_url=None,
            footer_extra=extra,
            brand_tag_color=_THEME_PURPLE,
            footer_signature_color=_THEME_PURPLE,
        )

    return send_email(to_email, subject, plain, html_body)


def send_ot_onboarding_rejected_email(
    to_email: str,
    contact_name: str,
    company_name: str,
    reason: str | None = None,
) -> tuple[bool, str | None]:
    """Polite rejection; cites verification / infra fit when generic."""
    settings = get_settings()
    brand = settings.smtp_from_name.strip() or settings.app_name.strip() or "ICS Guard"
    who = (contact_name or "").strip() or "there"
    org = (company_name or "").strip() or "your organization"
    subject = f"{brand} — Registration update"

    tail = (
        reason.strip()
        if reason and reason.strip()
        else (
            "Typical causes include unsupported infrastructure scope, incomplete verification details, "
            "or tenancy policies that reserve access for nominated partner organizations."
        )
    )

    lead = (
        f"Hello {who}, thank you for your interest on behalf of {org}. "
        f"After review we are unable to approve this registration at this time. {tail}\n\n"
        "No access has been provisioned on the platform. "
        "If you believe this decision was reached in error, reply to your ICS security contact "
        "or submit a new request once requirements are met."
    )

    plain = f"{brand}\n\n{lead}\n\n— OT Sentinel Team"

    html_body = _html_email_shell(
        brand_title=brand,
        headline="Registration not approved",
        lead=lead.replace("\n\n", "\n"),
        cta_label=None,
        action_url=None,
        footer_extra="Industrial OT security onboarding · This mailbox may not receive replies.",
        brand_tag_color="#f87171",
        cta_gradient=None,
        footer_signature_color=_THEME_MUTED,
    )

    return send_email(to_email, subject, plain, html_body)


def send_password_reset_email(to_email: str, token: str) -> tuple[bool, str | None]:
    settings = get_settings()
    brand = settings.smtp_from_name.strip() or settings.app_name.strip() or "ICS Guard"
    expire_min = settings.password_reset_token_expire_minutes
    link = _build_action_link(settings.frontend_base_url, settings.password_reset_path, token)
    subject = f"{brand} — Reset your password"

    if link:
        plain = (
            f"{brand}\n\n"
            "Use the secure link below to open our site and choose a new password.\n"
            "Your reset token is not shown in this email — only the link carries it.\n\n"
            f"{link}\n\n"
            f"This link expires in about {expire_min} minutes.\n"
            "If you did not request a reset, you can ignore this email."
        )
        html_body = _html_email_shell(
            brand_title=brand,
            headline="Reset your password",
            lead=f"We received a request to reset your password. The secure link below expires in about {expire_min} minutes.",
            cta_label="Choose a new password",
            action_url=link,
            footer_extra="",
        )
    else:
        missing = (
            "Password reset links require FRONTEND_BASE_URL to be set on the server. "
            "Contact your administrator — your account remains unchanged until you complete a reset from the app."
        )
        plain = f"{brand}\n\n{missing}\n\nIf you did not request a reset, ignore this email."
        html_body = _html_email_shell(
            brand_title=brand,
            headline="Reset your password",
            lead="We could not include a reset link because the application URL is not configured on the server.",
            cta_label=None,
            action_url=None,
            footer_extra=missing,
        )

    return send_email(to_email, subject, plain, html_body)
