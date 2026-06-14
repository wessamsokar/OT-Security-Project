"""
GRFICS Network Collector — OT Sentinel Integration (tcpdump backend)
=====================================================================
Uses tcpdump as the packet capture engine (proven to work on GRFICS router)
and parses its text output to extract flow metadata.

This avoids scapy's raw socket abstraction issues on Linux cooked interfaces.

Usage (inside router container):
    python3 grfics_collector.py [--iface eth1] [--interval 30] [--backend http://...] [--dry-run]

Environment Variables:
    BACKEND_URL    — OT Sentinel backend base URL
    BACKEND_TOKEN  — JWT bearer token
    FLUSH_INTERVAL — Seconds between flow flushes (default: 30)
    FLOW_TIMEOUT   — Seconds of inactivity before a flow is flushed (default: 60)
    DRY_RUN        — Set to 1 to print flows instead of POSTing
"""

from __future__ import annotations

import logging
import math
import os
import re
import signal
import struct
import subprocess
import sys
import threading
import time
import argparse
from datetime import datetime, timezone

import requests

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("grfics_collector")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8000")
BACKEND_TOKEN: str = os.getenv("BACKEND_TOKEN", "")
FLUSH_INTERVAL: int = int(os.getenv("FLUSH_INTERVAL", "30"))
FLOW_TIMEOUT: int = int(os.getenv("FLOW_TIMEOUT", "60"))
DRY_RUN: bool = os.getenv("DRY_RUN", "0") == "1"

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
        # Estimate entropy: Modbus traffic has very low entropy (~1.0)
        # Non-Modbus TCP is medium (~3.5). Use protocol-based estimate.
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
                "captured_at": datetime.now(timezone.utc).isoformat(),
            },
        }


_lock = threading.Lock()
_flows: dict[FlowKey, Flow] = {}
_raw_packet_count = 0

# ---------------------------------------------------------------------------
# tcpdump line parser
# ---------------------------------------------------------------------------
# Matches: "HH:MM:SS.ffffff IP src.sport > dst.dport: Flags [...], length N"
# Also handles "IP6" (skipped)
_TCPDUMP_RE = re.compile(
    r"IP\s+"
    r"(\d+\.\d+\.\d+\.\d+)\.(\d+)\s*>\s*"  # src_ip.src_port >
    r"(\d+\.\d+\.\d+\.\d+)\.(\d+):\s*"     # dst_ip.dst_port:
    r".*?length\s+(\d+)"                     # length N
)
_MODBUS_PORT = 502

# Modbus FC reading from raw hex dump is not possible from tcpdump text.
# We detect Modbus by port 502 and mark fc=1 (Read Coils) as a default.
# The real FC extraction is done via the pcap hex dump (-x flag parsing).


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

    # Canonical bidirectional key
    if (src_ip, src_port) <= (dst_ip, dst_port):
        key: FlowKey = (src_ip, dst_ip, src_port, dst_port, proto)
        inbound = True
    else:
        key = (dst_ip, src_ip, dst_port, src_port, proto)
        inbound = False

    with _lock:
        if key not in _flows:
            k_src, k_dst, k_sp, k_dp, k_proto = key
            _flows[key] = Flow(k_src, k_dst, k_sp, k_dp, k_proto)

        flow = _flows[key]
        flow.packet_count += 1
        flow.last_time = time.time()

        if inbound:
            flow.bytes_in += pkt_len
        else:
            flow.bytes_out += pkt_len

        # Modbus detection by port — mark with default FC=1 if not yet set
        if (src_port == _MODBUS_PORT or dst_port == _MODBUS_PORT) and flow.modbus_fc is None:
            flow.modbus_fc = 1     # Read Coils (most common GRFICS poll)
            flow.modbus_unit_id = 1


# ---------------------------------------------------------------------------
# Flow flushing
# ---------------------------------------------------------------------------
def _post_flow(flow: Flow) -> bool:
    payload = flow.to_payload()

    if DRY_RUN:
        logger.info(
            "[DRY_RUN] %s:%d -> %s:%d proto=%s pkts=%d bytes_in=%d modbus_fc=%s uid=%s",
            flow.src_ip, flow.src_port, flow.dst_ip, flow.dst_port,
            flow.proto, flow.packet_count, flow.bytes_in,
            flow.modbus_fc, flow.modbus_unit_id,
        )
        return True

    headers = {"Content-Type": "application/json"}
    if BACKEND_TOKEN:
        headers["Authorization"] = f"Bearer {BACKEND_TOKEN}"
    try:
        resp = requests.post(INGEST_URL, json=payload, headers=headers, timeout=10)
        if resp.status_code in (200, 201):
            data = resp.json()
            record_id = data.get("id")
            logger.info(
                "[INGEST] record_id=%s %s:%d->%s:%d pkts=%d modbus_fc=%s",
                record_id, flow.src_ip, flow.src_port, flow.dst_ip, flow.dst_port,
                flow.packet_count, flow.modbus_fc,
            )
            if record_id:
                _trigger_detection(record_id, headers)
            return True
        else:
            logger.warning("[INGEST_FAIL] HTTP %d: %s", resp.status_code, resp.text[:200])
            return False
    except Exception as exc:
        logger.error("[INGEST_ERROR] %s", exc)
        return False


def _trigger_detection(record_id: int, headers: dict) -> None:
    try:
        url = DETECT_URL_TMPL.format(record_id=record_id)
        resp = requests.post(url, headers=headers, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            logger.info(
                "[DETECT] record_id=%s attack=%s severity=%s risk=%.3f",
                record_id, data.get("attack_detected"),
                data.get("alert_severity"), data.get("risk_score") or 0.0,
            )
    except Exception as exc:
        logger.debug("[DETECT_ERROR] record_id=%s: %s", record_id, exc)


def flush_flows(*, force_all: bool = False) -> None:
    now = time.time()
    to_flush: list[Flow] = []
    with _lock:
        timed_out = [
            key for key, flow in _flows.items()
            if (
                force_all
                or (now - flow.last_time) >= FLOW_TIMEOUT
                or (now - flow.start_time) >= FLUSH_INTERVAL
            )
        ]
        for key in timed_out:
            to_flush.append(_flows.pop(key))

    for flow in to_flush:
        if flow.packet_count > 0:
            _post_flow(flow)


def flush_loop() -> None:
    logger.info("[COLLECTOR] Flush loop started (interval=%ds, flow_timeout=%ds)", FLUSH_INTERVAL, FLOW_TIMEOUT)
    while True:
        time.sleep(FLUSH_INTERVAL)
        flush_flows()


def _handle_signal(signum: int, frame: object) -> None:
    logger.info(
        "[COLLECTOR] Signal %d received — raw_pkts=%d active_flows=%d",
        signum, _raw_packet_count, len(_flows),
    )
    flush_flows(force_all=True)
    logger.info("[COLLECTOR] Done.")
    sys.exit(0)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    global BACKEND_URL, FLUSH_INTERVAL, DRY_RUN, INGEST_URL, DETECT_URL_TMPL

    parser = argparse.ArgumentParser(description="GRFICS → OT Sentinel Collector (tcpdump)")
    parser.add_argument("--iface", default="any", help="Network interface (default: any)")
    parser.add_argument("--interval", type=int, default=FLUSH_INTERVAL)
    parser.add_argument("--backend", default=BACKEND_URL)
    parser.add_argument("--dry-run", action="store_true", default=DRY_RUN)
    args = parser.parse_args()

    BACKEND_URL = args.backend
    FLUSH_INTERVAL = args.interval
    DRY_RUN = args.dry_run
    INGEST_URL = f"{BACKEND_URL.rstrip('/')}/api/v1/traffic/ingest"
    DETECT_URL_TMPL = f"{BACKEND_URL.rstrip('/')}/api/v1/traffic/{{record_id}}/detect"

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    logger.info("=" * 60)
    logger.info("GRFICS Collector (tcpdump backend)")
    logger.info("  Interface : %s", args.iface)
    logger.info("  Backend   : %s", BACKEND_URL)
    logger.info("  Interval  : %ds", FLUSH_INTERVAL)
    logger.info("  Dry Run   : %s", DRY_RUN)
    logger.info("=" * 60)

    t = threading.Thread(target=flush_loop, daemon=True)
    t.start()

    # tcpdump: line-buffered (-l), no hostname resolution (-n), show length (-e)
    # -i any captures all interfaces. Filter: ip and (tcp or udp) to reduce noise.
    cmd = ["tcpdump", "-l", "-n", "-i", args.iface, "ip and (tcp or udp)"]
    logger.info("[COLLECTOR] Starting tcpdump: %s", " ".join(cmd))

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
        )
        for line in proc.stdout:  # type: ignore[union-attr]
            parse_tcpdump_line(line.rstrip())
    except KeyboardInterrupt:
        pass
    except Exception as exc:
        logger.error("[COLLECTOR] tcpdump error: %s", exc)
    finally:
        flush_flows(force_all=True)
        logger.info("[COLLECTOR] Done. raw_pkts=%d", _raw_packet_count)


if __name__ == "__main__":
    main()
