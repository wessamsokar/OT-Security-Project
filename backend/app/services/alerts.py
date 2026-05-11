from app.models.alert import Alert, AlertSeverity


_ALERT_SEVERITY_MAP: dict[str, AlertSeverity] = {
    "low": AlertSeverity.low,
    "medium": AlertSeverity.medium,
    "high": AlertSeverity.high,
    "critical": AlertSeverity.critical,
}


def severity_from_ml_alert_string(alert_severity: str) -> AlertSeverity:
    """Maps ML canonical alert_severity to ORM enum — string-to-enum only, no scoring logic."""
    key = alert_severity.strip().lower()
    mapped = _ALERT_SEVERITY_MAP.get(key)
    if mapped is None:
        raise ValueError(f"Unknown alert_severity from ML: {alert_severity!r}")
    return mapped


def should_generate_alert_from_ml(attack_detected: bool) -> bool:
    """Alert rows are created only when ML sets attack_detected (canonical contract)."""
    return bool(attack_detected)


def make_alert_summary(attack_class: str | None, ml_status: str, alert_severity: str, score: float | None) -> str:
    sc = "--" if score is None else f"{score:.4f}"
    ac = attack_class or "unknown"
    sev = alert_severity.strip().lower()
    return f"{ac} status={ml_status} sev={sev} risk={sc}"
