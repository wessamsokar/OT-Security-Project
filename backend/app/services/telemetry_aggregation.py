"""
Centralized Telemetry Aggregation Service
==========================================
Single source of truth for all traffic metrics used across:
  - Traffic Telemetry page  (/api/v1/traffic/packets-by-hour)
  - SOC Health page         (/api/v1/model/soc-health)
  - Dashboard summary       (/api/v1/alerts/dashboard)
  - Protocol visibility     (/api/v1/traffic/protocol-distribution)

Metric Glossary (used consistently throughout the codebase)
------------------------------------------------------------
  flow_count      : COUNT of TrafficRecord rows — one row per ingested network flow.
                    A "flow" is a single session/conversation between src→dst.
                    This is what the ML pipeline processes and alerts are attached to.

  packet_count    : SUM of TrafficRecord.packet_count — the actual number of network
                    packets carried across all flows. One flow can carry many packets
                    (e.g. a Modbus poll flow may contain 1 request + 1 response = 2 pkts).
                    This is the raw network volume metric.

  telemetry_rows  : Synonym for flow_count in reporting context. Emphasises that each
                    row is a telemetry record submitted by a sensor, not a packet.

  alert_count     : COUNT of Alert rows linked to TrafficRecord via traffic_record_id.
                    Each flow may produce 0 or 1 alerts (when ML detects an attack).

Time Windows
------------
  rolling_15m     : last 15 minutes — used for live throughput health
  rolling_5m      : last 5 minutes  — used for burst detection
  rolling_1m      : last 1 minute   — used for realtime display
  window_24h      : last 24 hours   — used for daily operational summaries
  hourly_buckets  : packets/flows grouped by hour label "HH:00" within window_24h

Idempotency Guarantee
---------------------
  All aggregation functions in this module are PURE READ — they never write to the
  database. Repeated calls with the same parameters always return the same result
  for the same underlying data state.

  Topology edge accumulation is handled separately in topology.py with idempotency
  guards (last_traffic_record_id tracking prevents double-counting).
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import TypedDict

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.traffic_record import TrafficRecord

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Return types (TypedDicts for clarity — avoid Pydantic overhead in service)
# ---------------------------------------------------------------------------

class HourlyBucket(TypedDict):
    """One hour's worth of aggregated traffic metrics."""
    hour: str               # "HH:00" label (UTC)
    flow_count: int         # Number of TrafficRecord rows in this hour
    packet_count: int       # Sum of TrafficRecord.packet_count in this hour
    dominant_protocol: str  # Most common transport_protocol in this hour


class TelemetrySummary(TypedDict):
    """Full 24h telemetry summary — single source of truth."""
    # ---- Flow metrics (COUNT of TrafficRecord rows) ----
    flow_count_24h: int          # How many flow records were ingested in the last 24h
    flow_count_15min: int        # Flow records in the last 15 minutes (live health)
    flow_count_5min: int         # Flow records in the last 5 minutes
    flow_count_1min: int         # Flow records in the last 1 minute

    # ---- Packet metrics (SUM of TrafficRecord.packet_count) ----
    packet_count_24h: int        # Total network packets across all flows in 24h
    packet_count_15min: int      # Network packets in the last 15 minutes
    packet_count_5min: int       # Network packets in the last 5 minutes
    packet_count_1min: int       # Network packets in the last 1 minute

    # ---- Derived rate metrics ----
    avg_packets_per_minute_15m: float  # packet_count_15min / 15 (not hardcoded 24*60)
    avg_flows_per_minute_15m: float    # flow_count_15min / 15

    # ---- Peak / bucketed metrics ----
    hourly_buckets: list[HourlyBucket]  # Per-hour breakdown of the last 24h
    peak_hour: str                       # "HH:00" of the hour with most packets (24h)
    last_traffic_at: datetime | None     # Timestamp of the most recent TrafficRecord

    # ---- Alert metrics (separate from traffic/flow counts) ----
    alert_count_24h: int         # Alert rows linked to flows in the last 24h
    alert_count_15min: int       # Alert rows in the last 15 minutes

    # ---- All-time historical totals (for dashboards that need full history) ----
    total_flow_records_alltime: int  # COUNT(*) of all TrafficRecord rows (no time filter)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _utcnow() -> datetime:
    """Return naive UTC datetime (DB stores naive UTC)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _apply_tenant_filter(query, tenant_ids: list[int] | None):
    """Apply tenant scoping to a TrafficRecord query if tenant_ids is set."""
    if tenant_ids is not None:
        query = query.filter(TrafficRecord.user_id.in_(tenant_ids))
    return query


# ---------------------------------------------------------------------------
# Main aggregation entry point
# ---------------------------------------------------------------------------

def build_telemetry_summary(
    db: Session,
    tenant_ids: list[int] | None,
    *,
    source_endpoint: str = "unknown",
) -> TelemetrySummary:
    """
    Compute a complete telemetry summary from the TrafficRecord table.

    Parameters
    ----------
    db          : Active SQLAlchemy session (read-only — no writes performed)
    tenant_ids  : Scoping filter; None means admin-sees-all
    source_endpoint : Debug label identifying which endpoint triggered this call

    Returns a TelemetrySummary with all packet, flow, and alert metrics for
    the standard time windows (1m, 5m, 15m, 24h).

    This function is the SINGLE source of truth — all traffic-related endpoints
    call this instead of writing their own aggregation queries.
    """
    now = _utcnow()
    since_24h  = now - timedelta(hours=24)
    since_15m  = now - timedelta(minutes=15)
    since_5m   = now - timedelta(minutes=5)
    since_1m   = now - timedelta(minutes=1)

    # Base query scoped to tenant (avoids re-specifying tenant filter everywhere)
    base_q = db.query(TrafficRecord)
    base_q = _apply_tenant_filter(base_q, tenant_ids)

    # ------------------------------------------------------------------ #
    #  FLOW COUNTS — COUNT(TrafficRecord.id) per time window              #
    #  A "flow" = one ingested TrafficRecord row from a sensor.           #
    # ------------------------------------------------------------------ #
    def _count_flows(since: datetime) -> int:
        return (
            base_q.filter(TrafficRecord.created_at >= since)
            .with_entities(func.count(TrafficRecord.id))
            .scalar()
            or 0
        )

    flow_count_24h  = _count_flows(since_24h)
    flow_count_15m  = _count_flows(since_15m)
    flow_count_5m   = _count_flows(since_5m)
    flow_count_1m   = _count_flows(since_1m)

    # ------------------------------------------------------------------ #
    #  PACKET COUNTS — SUM(TrafficRecord.packet_count) per time window    #
    #  packet_count per row = actual network packets in that flow.        #
    #  Example: a Modbus poll = 2 packets (request + response).           #
    # ------------------------------------------------------------------ #
    def _sum_packets(since: datetime) -> int:
        return int(
            base_q.filter(TrafficRecord.created_at >= since)
            .with_entities(func.sum(TrafficRecord.packet_count))
            .scalar()
            or 0
        )

    packet_count_24h = _sum_packets(since_24h)
    packet_count_15m = _sum_packets(since_15m)
    packet_count_5m  = _sum_packets(since_5m)
    packet_count_1m  = _sum_packets(since_1m)

    # ------------------------------------------------------------------ #
    #  DERIVED RATES                                                       #
    #  avg_per_minute uses the ACTUAL rolling window (15m = 15 minutes),  #
    #  NOT a hardcoded 24*60. This gives meaningful realtime throughput.   #
    # ------------------------------------------------------------------ #
    window_minutes = 15.0
    avg_packets_per_minute_15m = packet_count_15m / window_minutes
    avg_flows_per_minute_15m   = flow_count_15m  / window_minutes

    # ------------------------------------------------------------------ #
    #  HOURLY BUCKETS — per-hour breakdown for the last 24h               #
    #  Groups records by "HH:00" label for the Traffic Telemetry table.   #
    # ------------------------------------------------------------------ #
    records_24h = (
        base_q.filter(TrafficRecord.created_at >= since_24h)
        .with_entities(
            TrafficRecord.created_at,
            TrafficRecord.packet_count,
            TrafficRecord.transport_protocol,
        )
        .all()
    )

    per_hour_flows:    dict[str, int]             = defaultdict(int)
    per_hour_packets:  dict[str, int]             = defaultdict(int)
    per_hour_protocols: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for created_at, pkt_count, protocol in records_24h:
        hour_key = created_at.strftime("%H:00")
        per_hour_flows[hour_key]   += 1
        per_hour_packets[hour_key] += int(pkt_count or 0)
        proto = (protocol or "unknown").upper()
        per_hour_protocols[hour_key][proto] += int(pkt_count or 0)

    hourly_buckets: list[HourlyBucket] = []
    for hour in sorted(per_hour_packets.keys()):
        proto_counts = per_hour_protocols[hour]
        dominant = max(proto_counts, key=lambda k: proto_counts[k]) if proto_counts else "N/A"
        hourly_buckets.append(
            HourlyBucket(
                hour=hour,
                flow_count=per_hour_flows[hour],
                packet_count=per_hour_packets[hour],
                dominant_protocol=dominant,
            )
        )

    peak_hour = max(per_hour_packets, key=lambda h: per_hour_packets[h]) if per_hour_packets else "N/A"

    # ------------------------------------------------------------------ #
    #  LAST TRAFFIC TIMESTAMP                                             #
    # ------------------------------------------------------------------ #
    last_traffic_at: datetime | None = (
        base_q.with_entities(func.max(TrafficRecord.created_at)).scalar()
    )

    # ------------------------------------------------------------------ #
    #  ALERT COUNTS — separate metric, not mixed with flow/packet counts  #
    # ------------------------------------------------------------------ #
    alert_base = (
        db.query(Alert)
        .join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
    )
    if tenant_ids is not None:
        alert_base = alert_base.filter(TrafficRecord.user_id.in_(tenant_ids))

    alert_count_24h = (
        alert_base.filter(Alert.created_at >= since_24h)
        .with_entities(func.count(Alert.id))
        .scalar()
        or 0
    )
    alert_count_15m = (
        alert_base.filter(Alert.created_at >= since_15m)
        .with_entities(func.count(Alert.id))
        .scalar()
        or 0
    )

    # ------------------------------------------------------------------ #
    #  ALL-TIME HISTORICAL TOTAL                                          #
    #  Kept separately from windowed metrics to prevent confusion.        #
    # ------------------------------------------------------------------ #
    total_alltime = (
        base_q.with_entities(func.count(TrafficRecord.id)).scalar() or 0
    )

    # ------------------------------------------------------------------ #
    #  DEBUG LOGGING — temporary aggregation verification                 #
    #  Log key metrics so anomalies can be spotted during testing.        #
    # ------------------------------------------------------------------ #
    logger.debug(
        "[telemetry_agg] endpoint=%s tenant_ids=%s window=24h "
        "flows=%d packets=%d alerts=%d | "
        "15m flows=%d packets=%d | "
        "alltime_flows=%d",
        source_endpoint,
        tenant_ids,
        flow_count_24h,
        packet_count_24h,
        alert_count_24h,
        flow_count_15m,
        packet_count_15m,
        total_alltime,
    )

    return TelemetrySummary(
        # Flow counts
        flow_count_24h=int(flow_count_24h),
        flow_count_15min=int(flow_count_15m),
        flow_count_5min=int(flow_count_5m),
        flow_count_1min=int(flow_count_1m),
        # Packet counts
        packet_count_24h=int(packet_count_24h),
        packet_count_15min=int(packet_count_15m),
        packet_count_5min=int(packet_count_5m),
        packet_count_1min=int(packet_count_1m),
        # Rates
        avg_packets_per_minute_15m=avg_packets_per_minute_15m,
        avg_flows_per_minute_15m=avg_flows_per_minute_15m,
        # Bucketed
        hourly_buckets=hourly_buckets,
        peak_hour=peak_hour,
        last_traffic_at=last_traffic_at,
        # Alerts
        alert_count_24h=int(alert_count_24h),
        alert_count_15min=int(alert_count_15m),
        # Historical
        total_flow_records_alltime=int(total_alltime),
    )
