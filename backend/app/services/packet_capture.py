import logging
import threading
import time
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class CaptureState:
    capture_id: str
    file_path: Path
    stop_event: threading.Event
    status: str = "started"


_capture_states: dict[str, CaptureState] = {}
_capture_lock = threading.Lock()


def _run_capture(
    state: CaptureState,
    interface: str | None,
    duration_seconds: int,
    packet_count: int | None,
    bpf_filter: str | None,
) -> None:
    try:
        from scapy.all import sniff, wrpcap
    except ImportError:
        logger.error("Scapy is not installed. Packet capture skipped.")
        with _capture_lock:
            state.status = "failed"
        return

    packets = []
    remaining = packet_count
    deadline = time.time() + duration_seconds

    try:
        while not state.stop_event.is_set():
            now = time.time()
            if now >= deadline:
                break

            timeout = min(1.0, max(0.1, deadline - now))
            sniff_args: dict[str, object] = {"timeout": timeout}
            if interface:
                sniff_args["iface"] = interface
            if bpf_filter:
                sniff_args["filter"] = bpf_filter
            if remaining is not None:
                sniff_args["count"] = max(1, min(remaining, 250))

            chunk = sniff(**sniff_args)
            if chunk:
                packets.extend(chunk)
                if remaining is not None:
                    remaining -= len(chunk)
                    if remaining <= 0:
                        break

        if packets:
            state.file_path.parent.mkdir(parents=True, exist_ok=True)
            wrpcap(str(state.file_path), packets)

        with _capture_lock:
            if state.stop_event.is_set():
                state.status = "stopped"
            else:
                state.status = "completed"
    except Exception:
        logger.exception("Packet capture failed")
        with _capture_lock:
            state.status = "failed"


def start_packet_capture(
    capture_id: str,
    file_path: Path,
    interface: str | None,
    duration_seconds: int,
    packet_count: int | None,
    bpf_filter: str | None,
) -> None:
    state = CaptureState(
        capture_id=capture_id,
        file_path=file_path,
        stop_event=threading.Event(),
    )

    with _capture_lock:
        _capture_states[capture_id] = state

    thread = threading.Thread(
        target=_run_capture,
        kwargs={
            "state": state,
            "interface": interface,
            "duration_seconds": duration_seconds,
            "packet_count": packet_count,
            "bpf_filter": bpf_filter,
        },
        daemon=True,
    )
    thread.start()


def stop_packet_capture(capture_id: str) -> str | None:
    with _capture_lock:
        state = _capture_states.get(capture_id)
        if not state:
            return None
        if state.status in {"completed", "failed", "stopped"}:
            return state.status
        state.stop_event.set()
        state.status = "stopping"
        return "stopping"


def get_packet_capture_status(capture_id: str) -> str | None:
    with _capture_lock:
        state = _capture_states.get(capture_id)
        if not state:
            return None
        return state.status
