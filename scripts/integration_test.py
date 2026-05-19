import json
import os
from http.cookiejar import CookieJar
from urllib import request

BASE = os.environ.get("ICS_API_BASE", "http://localhost:8080/api/v1").rstrip("/")
USERNAME = os.environ.get("ICS_TEST_USERNAME", "admin")
PASSWORD = os.environ.get("ICS_TEST_PASSWORD")
COOKIE_JAR = CookieJar()
OPENER = request.build_opener(request.HTTPCookieProcessor(COOKIE_JAR))
CSRF_TOKEN: str | None = None


def http_json(method: str, url: str, payload: dict | None = None) -> dict:
    body = json.dumps(payload).encode("utf-8") if payload else None
    headers = {"Content-Type": "application/json"}
    if method.upper() in {"POST", "PUT", "PATCH", "DELETE"} and CSRF_TOKEN:
        headers["X-CSRF-Token"] = CSRF_TOKEN

    req = request.Request(url=url, data=body, headers=headers, method=method)
    with OPENER.open(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run() -> None:
    global CSRF_TOKEN
    if not PASSWORD:
        raise SystemExit("Set ICS_TEST_PASSWORD before running this integration test.")

    csrf = http_json("GET", f"{BASE}/auth/csrf")
    CSRF_TOKEN = csrf["csrf_token"]

    http_json(
        "POST",
        f"{BASE}/auth/login",
        {"username": USERNAME, "password": PASSWORD},
    )

    ingest_payload = {
        "source_ip": "10.0.0.10",
        "destination_ip": "10.0.0.20",
        "source_port": 50222,
        "destination_port": 502,
        "transport_protocol": "tcp",
        "packet_count": 90,
        "bytes_in": 4100,
        "bytes_out": 5300,
        "duration_ms": 190,
        "payload_entropy": 5.8,
        "modbus_function_code": 16,
        "modbus_unit_id": 2,
        "dnp3_function_code": 1,
        "iec104_type_id": 45,
        "ingestion_source": "json",
        "metadata_json": {"asset": "PLC-A"},
    }

    ingest = http_json("POST", f"{BASE}/traffic/ingest", ingest_payload)
    record_id = ingest["id"]

    detect = http_json("POST", f"{BASE}/traffic/{record_id}/detect")

    http_json("GET", f"{BASE}/alerts")

    http_json("POST", f"{BASE}/model/retrain")

    print("Integration test passed")
    print("Detection:", detect)


if __name__ == "__main__":
    run()
