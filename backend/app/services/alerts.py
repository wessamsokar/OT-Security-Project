from app.models.alert import Alert, AlertSeverity


def score_to_severity(score: float) -> AlertSeverity:
    if score >= 0.9:
        return AlertSeverity.critical
    if score >= 0.75:
        return AlertSeverity.high
    if score >= 0.5:
        return AlertSeverity.medium
    return AlertSeverity.low


def make_alert_summary(attack_class: str, score: float) -> str:
    return f"{attack_class} detected with risk score {score:.2f}"


def should_generate_alert(score: float, confidence: float) -> bool:
    return score >= 0.5 and confidence >= 0.55
