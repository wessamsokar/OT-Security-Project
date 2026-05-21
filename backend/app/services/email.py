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


def _format_text(text: str) -> str:
    return _escape(text).replace("\n", "<br />")


def _render_preheader(text: str) -> str:
    return (
        "<div style=\"display:none;font-size:1px;color:#060c1c;line-height:1px;"
        "max-height:0;max-width:0;opacity:0;overflow:hidden;\">"
        f"{_escape(text)}"
        "</div>"
    )


def _render_header(brand_title: str, headline: str, lead: str, *, tag_color: str) -> str:
    return (
        "<p style=\"margin:0 0 6px 0;font-size:11px;letter-spacing:0.14em;"
        f"text-transform:uppercase;color:{tag_color};\">{_escape(brand_title)}</p>"
        f"<h1 style=\"margin:0 0 14px 0;font-size:22px;font-weight:600;"
        f"color:{_THEME_TEXT};line-height:1.25;\">{_escape(headline)}</h1>"
        f"<p style=\"margin:0;font-size:15px;line-height:1.6;"
        f"color:{_THEME_MUTED};\">{_format_text(lead)}</p>"
    )


def _render_divider() -> str:
    return f"<hr style=\"border:none;border-top:1px solid {_THEME_BORDER};margin:20px 0;\" />"


def _render_greeting(name: str) -> str:
    safe = _escape(name)
    return (
        f"<p style=\"margin:18px 0 10px 0;font-size:14px;line-height:1.6;"
        f"color:{_THEME_TEXT};\">Hello {safe},</p>"
    )


def _render_button(label: str, url: str, *, gradient: str) -> str:
    label_safe = _escape(label)
    url_safe = html.escape(url, quote=True)
    return (
        "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
        "style=\"margin:26px 0 0 0;\">"
        "<tr>"
        f"<td align=\"center\" style=\"border-radius:12px;background-color:{_THEME_BRAND};"
        f"background-image:{gradient};\">"
        f"<a href=\"{url_safe}\" target=\"_blank\" rel=\"noopener noreferrer\" "
        "style=\"display:inline-block;padding:14px 28px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;"
        "font-size:15px;font-weight:600;color:#060c1c;text-decoration:none;border-radius:12px;\">"
        f"{label_safe}</a>"
        "</td></tr></table>"
    )


def _render_fallback_link(url: str, label: str = "Secure fallback link") -> str:
    url_safe = html.escape(url, quote=True)
    return (
        "<p style=\"margin:14px 0 0 0;font-size:12px;line-height:1.55;"
        f"color:{_THEME_MUTED};\">"
        f"{_escape(label)}: <a href=\"{url_safe}\" style=\"color:{_THEME_BRAND};\">{url_safe}</a>"
        "</p>"
    )


def _render_security_notice(text: str) -> str:
    return (
        f"<div style=\"margin:18px 0 0 0;padding:14px 16px;border-radius:12px;"
        f"border:1px solid {_THEME_BORDER};background:rgba(13,23,52,0.9);\">"
        f"<p style=\"margin:0;font-size:13px;line-height:1.55;color:{_THEME_MUTED};\">"
        f"{_format_text(text)}</p></div>"
    )


def _render_warning_banner(text: str) -> str:
    return (
        "<div style=\"margin:18px 0 0 0;padding:14px 16px;border-radius:12px;"
        "border:1px solid rgba(248,113,113,0.5);background:rgba(88,22,22,0.35);\">"
        "<p style=\"margin:0;font-size:13px;line-height:1.55;color:#fda4af;\">"
        f"{_format_text(text)}</p></div>"
    )


def _render_expiration_notice(minutes: int) -> str:
    return _render_security_notice(
        f"Security note: this link expires in about {minutes} minutes."
    )


def _render_support_section(text: str) -> str:
    return (
        f"<p style=\"margin:0;font-size:12px;line-height:1.5;color:{_THEME_MUTED};\">"
        f"{_format_text(text)}</p>"
    )


def _render_footer(signature: str, extra: str | None) -> str:
    extra_html = _render_support_section(extra) if extra else ""
    return (
        f"{extra_html}"
        f"<p style=\"margin:12px 0 0 0;font-size:11px;color:{_THEME_PURPLE};"
        f"font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;\">{_escape(signature)}</p>"
    )


def _render_email_layout(body_html: str, footer_html: str, *, preheader: str | None = None) -> str:
    preheader_html = _render_preheader(preheader) if preheader else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:{_THEME_BG};">
  {preheader_html}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{_THEME_BG};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:{_THEME_PANEL};border-radius:20px;border:1px solid {_THEME_BORDER};overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 8px 28px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
              {body_html}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 28px 28px;border-top:1px solid {_THEME_BORDER};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
              {footer_html}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def _build_branded_email(
    *,
    brand_title: str,
    headline: str,
    lead: str,
    body_sections: list[str],
    footer_text: str,
    preheader: str | None = None,
    cta_label: str | None = None,
    action_url: str | None = None,
    cta_tip: str | None = None,
) -> str:
    header_html = _render_header(
        brand_title,
        headline,
        lead,
        tag_color=_THEME_PURPLE,
    )

    cta_html = ""
    if cta_label and action_url:
        cta_html = (
            _render_button(
                cta_label,
                action_url,
                gradient=f"linear-gradient(135deg,{_THEME_BRAND} 0%,{_THEME_PURPLE_DEEP} 100%)",
            )
            + (
                f"<p style=\"margin:12px 0 0 0;font-size:12px;line-height:1.5;color:{_THEME_MUTED};\">"
                f"{_escape(cta_tip or 'Open the secure link above in your browser.')}"
                "</p>"
            )
            + _render_fallback_link(action_url)
        )

    body_html = header_html + "".join(body_sections) + cta_html

    footer_html = _render_footer("— OT Sentinel", footer_text)
    return _render_email_layout(body_html, footer_html, preheader=preheader)


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
            f"This link will expire in {settings.email_verification_token_expire_hours} hours.\n"
            "We never display security tokens in this message.\n\n"
            f"{link}\n\n"
            "If you did not create an account, you can ignore this email."
        )
        html_body = _build_branded_email(
            brand_title=brand,
            headline="Confirm your email",
            lead="Welcome aboard. Verify your address to activate your OT Sentinel account.",
            body_sections=[
                _render_security_notice(
                    f"We never expose security tokens in email content. Use the secure button to proceed. This link will expire in {settings.email_verification_token_expire_hours} hours."
                ),
            ],
            footer_text="Industrial OT security · If you did not request this message, you can safely ignore it. Need help? Contact your administrator.",
            preheader="Verify your email to activate your OT Sentinel account.",
            cta_label="Verify email",
            action_url=link,
            cta_tip="Use the button above to confirm your email.",
        )
    else:
        missing = (
            "Email links are disabled until FRONTEND_BASE_URL is configured on the server. "
            "Ask your administrator to set it so verification links can be sent."
        )
        plain = f"{brand}\n\n{missing}\n\nIf you did not create an account, ignore this email."
        html_body = _build_branded_email(
            brand_title=brand,
            headline="Confirm your email",
            lead="We could not build a verification link because the application URL is not configured.",
            body_sections=[_render_warning_banner(missing)],
            footer_text="Industrial OT security · If you did not request this message, you can safely ignore it.",
            preheader="Verification link unavailable.",
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
        html_body = _build_branded_email(
            brand_title=brand,
            headline="Your email is verified",
            lead="An administrator has confirmed your email address on the platform.",
            body_sections=[
                _render_greeting(name),
                _render_security_notice("Use only approved corporate devices when accessing OT monitoring data."),
            ],
            footer_text="Industrial OT security · If you did not request this change, contact your SOC lead.",
            preheader="Your email has been verified by an administrator.",
            cta_label="Sign in",
            action_url=login_url,
            cta_tip="Use the button above to open the sign-in page.",
        )
    else:
        extra = (
            "Your email is verified. Open your organization’s OT Sentinel sign-in page in the browser. "
            "Ask your administrator to set FRONTEND_BASE_URL on the server for direct links in future emails."
        )
        plain = f"{brand}\n\nHello {name},\n\n{extra}\n\n— OT Sentinel"
        html_body = _build_branded_email(
            brand_title=brand,
            headline="Your email is verified",
            lead="An administrator has confirmed your email address on the platform.",
            body_sections=[_render_greeting(name), _render_warning_banner(extra)],
            footer_text="Industrial OT security · If you did not request this change, contact your SOC lead.",
            preheader="Email verified, sign-in link unavailable.",
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
        html_body = _build_branded_email(
            brand_title=brand,
            headline="Your account is approved",
            lead="Your OT Sentinel account has been approved by an administrator.",
            body_sections=[
                _render_greeting(name),
                _render_security_notice("Use your work email and MFA if configured by your tenancy."),
            ],
            footer_text="Industrial OT security · If you did not request this change, contact your SOC lead.",
            preheader="Account approved. Sign in when ready.",
            cta_label="Sign in",
            action_url=login_url,
            cta_tip="Use the button above to open the sign-in page.",
        )
    else:
        extra = (
            "Your account is approved. Open your organization’s OT Sentinel sign-in page. "
            "Configure FRONTEND_BASE_URL for direct sign-in links in future emails."
        )
        plain = f"{brand}\n\nHello {name},\n\n{extra}\n\n— OT Sentinel"
        html_body = _build_branded_email(
            brand_title=brand,
            headline="Your account is approved",
            lead="Your OT Sentinel account has been approved by an administrator.",
            body_sections=[_render_greeting(name), _render_warning_banner(extra)],
            footer_text="Industrial OT security · If you did not request this change, contact your SOC lead.",
            preheader="Account approved, sign-in link unavailable.",
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
        html_body = _build_branded_email(
            brand_title=brand,
            headline="Your access request was approved",
            lead=lead,
            body_sections=[
                _render_greeting(who),
                _render_security_notice(
                    "Use your work email and approved corporate devices. Contact your SOC lead if MFA or SSO applies."
                ),
            ],
            footer_text="Industrial OT security onboarding · If you did not request this access, contact your SOC lead.",
            preheader="Access approved for OT Sentinel.",
            cta_label="Access OT Sentinel",
            action_url=login_url,
            cta_tip="Secure sign-in opens in your browser.",
        )
    else:
        extra = (
            "Sign-in URL is configured by your administrator. Open your organization OT Sentinel gateway in the browser. "
            "Set FRONTEND_BASE_URL on the server to include direct links in outbound mail."
        )
        plain = f"{brand}\n\nHello {who},\n\n{lead}\n\n{extra}\n\n— OT Sentinel"
        html_body = _build_branded_email(
            brand_title=brand,
            headline="Your access request was approved",
            lead=lead,
            body_sections=[_render_greeting(who), _render_warning_banner(extra)],
            footer_text="Industrial OT security onboarding · If you did not request this access, contact your SOC lead.",
            preheader="Access approved, sign-in link unavailable.",
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

    html_body = _build_branded_email(
        brand_title=brand,
        headline="Registration not approved",
        lead="Your registration request could not be approved at this time.",
        body_sections=[
            _render_warning_banner(lead.replace("\n\n", "\n")),
        ],
        footer_text="Industrial OT security onboarding · This mailbox may not receive replies.",
        preheader="Registration update for OT Sentinel.",
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
        html_body = _build_branded_email(
            brand_title=brand,
            headline="Reset your password",
            lead="We received a request to reset your password for your OT Sentinel account.",
            body_sections=[
                _render_security_notice("We never expose security tokens in email content."),
                _render_expiration_notice(expire_min),
            ],
            footer_text="Industrial OT security · If you did not request this message, you can safely ignore it.",
            preheader="Reset your password securely.",
            cta_label="Choose a new password",
            action_url=link,
            cta_tip="This link is single-use and expires shortly.",
        )
    else:
        missing = (
            "Password reset links require FRONTEND_BASE_URL to be set on the server. "
            "Contact your administrator — your account remains unchanged until you complete a reset from the app."
        )
        plain = f"{brand}\n\n{missing}\n\nIf you did not request a reset, ignore this email."
        html_body = _build_branded_email(
            brand_title=brand,
            headline="Reset your password",
            lead="We could not include a reset link because the application URL is not configured on the server.",
            body_sections=[_render_warning_banner(missing)],
            footer_text="Industrial OT security · If you did not request this message, you can safely ignore it.",
            preheader="Reset link unavailable.",
        )

    return send_email(to_email, subject, plain, html_body)
