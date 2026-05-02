import { useState } from "react";

import { getPacketCaptureStatus, startPacketCapture, stopPacketCapture } from "../api/captureApi";
import { ingestTraffic, runDetection, type DetectionResponse, type ICSTrafficIn } from "../api/trafficApi";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";

const initialForm = {
  sourceIp: "10.0.0.10",
  destinationIp: "10.0.0.20",
  sourcePort: "52000",
  destinationPort: "502",
  protocol: "tcp",
  packetCount: "120",
  bytesIn: "4096",
  bytesOut: "5120",
  durationMs: "120",
  payloadEntropy: "4.2",
  modbusFunction: "16",
  modbusUnit: "3"
};

export function DemoPage() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState<DetectionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [captureLoading, setCaptureLoading] = useState(false);
  const [captureId, setCaptureId] = useState("");
  const [captureStatus, setCaptureStatus] = useState("");
  const [capturePath, setCapturePath] = useState("");

  const buildPayload = (): ICSTrafficIn | null => {
    const parsed = {
      source_ip: form.sourceIp.trim(),
      destination_ip: form.destinationIp.trim(),
      source_port: Number(form.sourcePort),
      destination_port: Number(form.destinationPort),
      transport_protocol: form.protocol as ICSTrafficIn["transport_protocol"],
      packet_count: Number(form.packetCount),
      bytes_in: Number(form.bytesIn),
      bytes_out: Number(form.bytesOut),
      duration_ms: Number(form.durationMs),
      payload_entropy: Number(form.payloadEntropy),
      modbus_function_code: form.modbusFunction ? Number(form.modbusFunction) : null,
      modbus_unit_id: form.modbusUnit ? Number(form.modbusUnit) : null,
      ingestion_source: "json" as const,
      metadata_json: { demo: true }
    };

    if (!parsed.source_ip || !parsed.destination_ip || Number.isNaN(parsed.source_port)) {
      return null;
    }

    return parsed;
  };

  const handleRunDemo = async () => {
    const payload = buildPayload();
    if (!payload) {
      setError("Please provide valid inputs for the demo payload.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const record = await ingestTraffic(payload);
      const detection = await runDetection(record.id);
      setResult(detection);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run detection demo.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartCapture = async () => {
    setCaptureLoading(true);
    setError("");
    try {
      const started = await startPacketCapture({ duration_seconds: 30 });
      setCaptureId(started.capture_id);
      setCaptureStatus(started.status);
      setCapturePath(started.file_path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start packet capture.");
    } finally {
      setCaptureLoading(false);
    }
  };

  const handleStopCapture = async () => {
    if (!captureId) {
      setError("No active capture session to stop.");
      return;
    }
    setCaptureLoading(true);
    setError("");
    try {
      const stopped = await stopPacketCapture(captureId);
      setCaptureStatus(stopped.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to stop packet capture.");
    } finally {
      setCaptureLoading(false);
    }
  };

  const handleRefreshCaptureStatus = async () => {
    if (!captureId) {
      setError("No capture session found.");
      return;
    }
    setCaptureLoading(true);
    setError("");
    try {
      const statusResult = await getPacketCaptureStatus(captureId);
      setCaptureStatus(statusResult.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch capture status.");
    } finally {
      setCaptureLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.16em] text-brand">Demo</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Detection Demo</h1>
        <p className="mt-1 text-sm text-muted">Run a live detection flow using the ML inference pipeline.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.15fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <InputField
              id="demo-source-ip"
              label="Source IP"
              value={form.sourceIp}
              onChange={(value) => setForm((prev) => ({ ...prev, sourceIp: value }))}
            />
            <InputField
              id="demo-destination-ip"
              label="Destination IP"
              value={form.destinationIp}
              onChange={(value) => setForm((prev) => ({ ...prev, destinationIp: value }))}
            />
            <InputField
              id="demo-source-port"
              label="Source port"
              value={form.sourcePort}
              onChange={(value) => setForm((prev) => ({ ...prev, sourcePort: value }))}
            />
            <InputField
              id="demo-destination-port"
              label="Destination port"
              value={form.destinationPort}
              onChange={(value) => setForm((prev) => ({ ...prev, destinationPort: value }))}
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <InputField
              id="demo-packet-count"
              label="Packet count"
              value={form.packetCount}
              onChange={(value) => setForm((prev) => ({ ...prev, packetCount: value }))}
            />
            <InputField
              id="demo-bytes-in"
              label="Bytes in"
              value={form.bytesIn}
              onChange={(value) => setForm((prev) => ({ ...prev, bytesIn: value }))}
            />
            <InputField
              id="demo-bytes-out"
              label="Bytes out"
              value={form.bytesOut}
              onChange={(value) => setForm((prev) => ({ ...prev, bytesOut: value }))}
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <InputField
              id="demo-duration"
              label="Duration (ms)"
              value={form.durationMs}
              onChange={(value) => setForm((prev) => ({ ...prev, durationMs: value }))}
            />
            <InputField
              id="demo-entropy"
              label="Payload entropy"
              value={form.payloadEntropy}
              onChange={(value) => setForm((prev) => ({ ...prev, payloadEntropy: value }))}
            />
            <label className="block">
              <span className="mb-2 block text-sm text-muted">Protocol</span>
              <select
                value={form.protocol}
                onChange={(event) => setForm((prev) => ({ ...prev, protocol: event.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-[#0c152d]/80 px-3 py-3 text-sm text-text outline-none transition focus:border-brand/70 focus:ring-2 focus:ring-brand/20"
              >
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
                <option value="icmp">ICMP</option>
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <InputField
              id="demo-modbus-function"
              label="Modbus function code"
              value={form.modbusFunction}
              onChange={(value) => setForm((prev) => ({ ...prev, modbusFunction: value }))}
            />
            <InputField
              id="demo-modbus-unit"
              label="Modbus unit id"
              value={form.modbusUnit}
              onChange={(value) => setForm((prev) => ({ ...prev, modbusUnit: value }))}
            />
          </div>

          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleRunDemo} loading={loading}>Run detection demo</Button>
            <Button variant="outline" onClick={() => {
              setForm(initialForm);
              setResult(null);
              setError("");
            }}>Reset</Button>
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Packet capture</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={handleStartCapture} loading={captureLoading}>
                Start capture
              </Button>
              <Button size="sm" variant="outline" onClick={handleStopCapture} loading={captureLoading}>
                Stop capture
              </Button>
              <Button size="sm" variant="ghost" onClick={handleRefreshCaptureStatus} loading={captureLoading}>
                Refresh status
              </Button>
            </div>
            {captureId ? (
              <div className="mt-3 text-xs text-muted">
                <p>Capture ID: <span className="text-white">{captureId}</span></p>
                <p>Status: <span className="text-white">{captureStatus || "unknown"}</span></p>
                <p>File: <span className="text-white">{capturePath || "n/a"}</span></p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Detection output</p>
          {result ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-muted">Attack class</p>
                <p className="mt-1 text-xl font-semibold text-white">{result.attack_class}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-muted">Risk score</p>
                  <p className="mt-1 text-lg text-rose-200">{result.risk_score.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-muted">Confidence</p>
                  <p className="mt-1 text-lg text-emerald-200">{(result.confidence * 100).toFixed(1)}%</p>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-muted">Model version</p>
                <p className="mt-1 text-sm text-white">{result.model_version ?? "unknown"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-muted">Explanation</p>
                <pre className="mt-2 max-h-48 overflow-auto text-xs text-slate-200">
                  {JSON.stringify(result.explanation, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Run the demo to see detection output.</p>
          )}
        </div>
      </div>
    </section>
  );
}
