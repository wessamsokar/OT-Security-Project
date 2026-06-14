"""
GRFICS → OT Sentinel Collector (Host-side, docker exec backend)
================================================================
Runs tcpdump inside the GRFICS router container via 'docker exec',
parses the text output on the host, aggregates flows, and POSTs
them to the OT Sentinel backend (reachable on the host network).

This is the recommended deployment for Windows + Docker Desktop environments
where the GRFICS and OT Sentinel networks are isolated Docker bridge networks.

Usage:
    python grfics_collector_host.py [options]

Options:
    --container   GRFICS container to run tcpdump in (default: router)
    --iface       Interface inside the container (default: eth1)
    --backend     OT Sentinel backend URL (default: http://localhost:8080)
    --token       JWT Bearer token for OT Sentinel API
    --interval    Flow flush interval in seconds (default: 30)
    --dry-run     Print flows to stdout instead of posting

Environment Variables (alternative to CLI args):
    BACKEND_URL      OT Sentinel backend base URL
    BACKEND_TOKEN    JWT Bearer token
    FLUSH_INTERVAL   Flow flush interval in seconds
    FLOW_TIMEOUT     Flow inactivity timeout in seconds
    DRY_RUN          Set to 1 for dry-run mode
    GRFICS_CONTAINER Docker container name (default: router)
    GRFICS_IFACE     Interface inside container (default: eth1)
"""

from __future__ import annotations

import argparse
import logging
import os
import re
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone

import requests

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("grfics_collector")

# ---------------------------------------------------------------------------
# Configuration (from env or CLI)
# ---------------------------------------------------------------------------
BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8080")
BACKEND_TOKEN: str = os.getenv("BACKEND_TOKEN", "")
FLUSH_INTERVAL: int = int(os.getenv("FLUSH_INTERVAL", "30"))
FLOW_TIMEOUT: int = int(os.getenv("FLOW_TIMEOUT", "60"))
DRY_RUN: bool = os.getenv("DRY_RUN", "0") == "1"
GRFICS_CONTAINER: str = os.getenv("GRFICS_CONTAINER", "router")
GRFICS_IFACE: str = os.getenv("GRFICS_IFACE", "eth1")

INGEST_URL = f"{BACKEND_URL.rstrip('/')}/api/v1/traffic/ingest"
DETECT_URL_TMPL = f"{BACKEND_URL.rstrip('/')}/api/v1/traffic/{{record_id}}/detect"

# ---------------------------------------------------------------------------
# Flow State
# ---------------------------------------------------------------------------
FlowKey = tuple[str, str, int, int, str]


class Flow:
    __slots__ = (
        "src_ip", "dst_ip", "src_port", "dst_port", "proto",
        "packet_count", "bytes_in", "bytes_out",
        "start_time", "last_time",
        "modbus_fc", "modbus_unit_id",
    )

    def __init__(self, src_ip: str, dst_ip: str, src_port: int, dst_port: int, proto: str):
        self.src_ip = src_ip
        self.dst_ip = dst_ip
        self.src_port = src_port
        self.dst_port = dst_port
        self.proto = proto
        self.packet_count = 0
        self.bytes_in = 0
        self.bytes_out = 0
        self.start_time = time.time()
        self.last_time = time.time()
        self.modbus_fc: int | None = None
        self.modbus_unit_id: int | None = None

    def duration_ms(self) -> float:
        return max(0.0, (self.last_time - self.start_time) * 1000)

    def to_payload(self) -> dict:
        if self.modbus_fc is not None:
            entropy = 1.2
        elif self.proto == "tcp":
            entropy = 3.5
        else:
            entropy = 2.0

        return {
            "source_ip": self.src_ip,
            "destination_ip": self.dst_ip,
            "source_port": self.src_port,
            "destination_port": self.dst_port,
            "transport_protocol": self.proto,
            "packet_count": max(1, self.packet_count),
            "bytes_in": self.bytes_in,
            "bytes_out": self.bytes_out,
            "duration_ms": self.duration_ms(),
            "payload_entropy": entropy,
            "modbus_function_code": self.modbus_fc,
            "modbus_unit_id": self.modbus_unit_id,
            "dnp3_function_code": None,
            "iec104_type_id": None,
            "ingestion_source": "pcap",
            "metadata_json": {
                "collector": "grfics_collector",
                "grfics_container": GRFICS_CONTAINER,
                "captured_at": datetime.now(timezone.utc).isoformat(),
            },
        }


_lock = threading.Lock()
_flows: dict[FlowKey, Flow] = {}
_raw_packet_count = 0

_TCPDUMP_RE = re.compile(
    r"IP\s+"
    r"(\d+\.\d+\.\d+\.\d+)\.(\d+)\s*>\s*"
    r"(\d+\.\d+\.\d+\.\d+)\.(\d+):\s*"
    r".*?length\s+(\d+)",
)


def parse_tcpdump_line(line: str) -> None:
    global _raw_packet_count
    m = _TCPDUMP_RE.search(line)
    if not m:
        return

    _raw_packet_count += 1
    src_ip, src_port_s, dst_ip, dst_port_s, length_s = m.groups()
    src_port = int(src_port_s)
    dst_port = int(dst_port_s)
    pkt_len = int(length_s)
    proto = "udp" if "UDP" in line.upper() else "tcp"

    if (src_ip, src_port) <= (dst_ip, dst_port):
        key: FlowKey = (src_ip, dst_ip, src_port, dst_port, proto)
        inbound = True
    else:
        key = (dst_ip, src_ip, dst_port, src_port, proto)
        inbound = False

    with _lock:
        if key not in _flows:
            k = key
            _flows[key] = Flow(k[0], k[1], k[2], k[3], k[4])

        flow = _flows[key]
        flow.packet_count += 1
        flow.last_time = time.time()

        if inbound:
            flow.bytes_in += pkt_len
        else:
            flow.bytes_out += pkt_len

        if (src_port == 502 or dst_port == 502) and flow.modbus_fc is None:
            flow.modbus_fc = 1
            flow.modbus_unit_id = 1


# ---------------------------------------------------------------------------
# Flow flushing & backend ingestion
# ---------------------------------------------------------------------------
def _post_flow(flow: Flow) -> None:
    payload = flow.to_payload()

    if DRY_RUN:
        logger.info(
            "[DRY_RUN] %s:%d -> %s:%d  proto=%s  pkts=%d  bytes_in=%d  modbus_fc=%s",
            flow.src_ip, flow.src_port, flow.dst_ip, flow.dst_port,
            flow.proto, flow.packet_count, flow.bytes_in, flow.modbus_fc,
        )
        return

    headers = {"Content-Type": "application/json"}
    if BACKEND_TOKEN:
        headers["Authorization"] = f"Bearer {BACKEND_TOKEN}"

    try:
        resp = requests.post(INGEST_URL, json=payload, headers=headers, timeout=10)
        if resp.status_code in (200, 201):
            data = resp.json()
            record_id = data.get("id")
            logger.info(
                "[INGEST] record_id=%s  %s:%d->%s:%d  pkts=%d  modbus_fc=%s",
                record_id,
                flow.src_ip, flow.src_port, flow.dst_ip, flow.dst_port,
                flow.packet_count, flow.modbus_fc,
            )
            if record_id:
                _trigger_ml(record_id, headers)
        else:
            logger.warning("[INGEST_FAIL] HTTP %d: %s", resp.status_code, resp.text[:300])
    except Exception as exc:
        logger.error("[INGEST_ERROR] %s", exc)


def _trigger_ml(record_id: int, headers: dict) -> None:
    try:
        url = DETECT_URL_TMPL.format(record_id=record_id)
        resp = requests.post(url, headers=headers, timeout=30)
        if resp.status_code == 200:
            d = resp.json()
            logger.info(
                "[ML] record_id=%s  attack=%s  severity=%s  risk=%.3f",
                record_id, d.get("attack_detected"),
                d.get("alert_severity"), d.get("risk_score") or 0.0,
            )
    except Exception as exc:
        logger.debug("[ML_ERROR] %s", exc)


def flush_flows(*, force_all: bool = False) -> None:
    now = time.time()
    to_flush: list[Flow] = []
    with _lock:
        keys = [
            k for k, f in _flows.items()
            if (
                force_all
                or (now - f.last_time) >= FLOW_TIMEOUT
                or (now - f.start_time) >= FLUSH_INTERVAL
            )
        ]
        for k in keys:
            to_flush.append(_flows.pop(k))

    for flow in to_flush:
        if flow.packet_count > 0:
            _post_flow(flow)


def flush_loop() -> None:
    logger.info("[COLLECTOR] Flush loop (interval=%ds, timeout=%ds)", FLUSH_INTERVAL, FLOW_TIMEOUT)
    while True:
        time.sleep(FLUSH_INTERVAL)
        flush_flows()


_proc: subprocess.Popen | None = None


def _handle_signal(signum: int, frame: object) -> None:
    logger.info(
        "[COLLECTOR] Signal %d — raw_pkts=%d active_flows=%d",
        signum, _raw_packet_count, len(_flows),
    )
    if _proc and _proc.poll() is None:
        _proc.terminate()
    flush_flows(force_all=True)
    logger.info("[COLLECTOR] Done.")
    sys.exit(0)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    global BACKEND_URL, BACKEND_TOKEN, FLUSH_INTERVAL, DRY_RUN
    global GRFICS_CONTAINER, GRFICS_IFACE, INGEST_URL, DETECT_URL_TMPL
    global _proc

    parser = argparse.ArgumentParser(description="GRFICS → OT Sentinel Collector")
    parser.add_argument("--container", default=GRFICS_CONTAINER)
    parser.add_argument("--iface", default=GRFICS_IFACE)
    parser.add_argument("--backend", default=BACKEND_URL)
    parser.add_argument("--token", default=BACKEND_TOKEN)
    parser.add_argument("--interval", type=int, default=FLUSH_INTERVAL)
    parser.add_argument("--dry-run", action="store_true", default=DRY_RUN)
    args = parser.parse_args()

    BACKEND_URL = args.backend
    BACKEND_TOKEN = args.token
    FLUSH_INTERVAL = args.interval
    DRY_RUN = args.dry_run
    GRFICS_CONTAINER = args.container
    GRFICS_IFACE = args.iface
    INGEST_URL = f"{BACKEND_URL.rstrip('/')}/api/v1/traffic/ingest"
    DETECT_URL_TMPL = f"{BACKEND_URL.rstrip('/')}/api/v1/traffic/{{record_id}}/detect"

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    logger.info("=" * 60)
    logger.info("GRFICS Collector (host-side, docker exec)")
    logger.info("  Container : %s / %s", GRFICS_CONTAINER, GRFICS_IFACE)
    logger.info("  Backend   : %s", BACKEND_URL)
    logger.info("  Interval  : %ds", FLUSH_INTERVAL)
    logger.info("  Dry Run   : %s", DRY_RUN)
    logger.info("=" * 60)

    t = threading.Thread(target=flush_loop, daemon=True)
    t.start()

    cmd = [
        "docker", "exec", GRFICS_CONTAINER,
        "tcpdump", "-l", "-n", "-i", GRFICS_IFACE,
        "ip and (tcp or udp)",
    ]
    logger.info("[COLLECTOR] Starting: %s", " ".join(cmd))

    try:
        _proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
        )
        for line in _proc.stdout:  # type: ignore[union-attr]
            parse_tcpdump_line(line.rstrip())
    except KeyboardInterrupt:
        pass
    except Exception as exc:
        logger.error("[COLLECTOR] Error: %s", exc)
    finally:
        if _proc and _proc.poll() is None:
            _proc.terminate()
        flush_flows(force_all=True)
        logger.info("[COLLECTOR] Done. raw_pkts=%d", _raw_packet_count)


if __name__ == "__main__":
    main()
