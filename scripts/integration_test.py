import json
from urllib import request

BASE = "http://localhost:8080/api/v1"


def http_json(method: str, url: str, payload: dict | None = None, token: str | None = None) -> dict:
    body = json.dumps(payload).encode("utf-8") if payload else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = request.Request(url=url, data=body, headers=headers, method=method)
    with request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run() -> None:
    login_resp = http_json(
        "POST",
        f"{BASE}/auth/login",
        {"username": "admin", "password": "admin123"},
    )
    token = login_resp["access_token"]

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

    ingest = http_json("POST", f"{BASE}/traffic/ingest", ingest_payload, token)
    record_id = ingest["id"]

    detect = http_json("POST", f"{BASE}/traffic/{record_id}/detect", None, token)

    http_json("GET", f"{BASE}/alerts", None, token)

    http_json("POST", f"{BASE}/model/retrain", None, token)

    print("Integration test passed")
    print("Detection:", detect)


if __name__ == "__main__":
    run()
