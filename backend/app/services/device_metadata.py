"""
Strip client-supplied keys that imply security posture; those fields are ML/backend-owned.
"""

from typing import Any

# Keys rejected from persisted device.metadata_json (defense in depth vs UI regressions).
_FORBIDDEN_DEVICE_METADATA_KEYS: frozenset[str] = frozenset(
    {
        "monitoring_status",
        "risk_score_estimate",
        # legacy UI keys that must not alter server state
        "ml_risk_score",
        "ml_status",
        "last_ml_risk_score",
        "last_ml_status",
        "ml_alert_severity",
        "ml_attack_detected",
        "alert_severity",
        "attack_detected",
    }
)


def sanitize_device_metadata(metadata: dict[str, Any] | None) -> dict[str, Any]:
    if not metadata:
        return {}
    return {k: v for k, v in metadata.items() if k not in _FORBIDDEN_DEVICE_METADATA_KEYS}
