import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { fetchInventoryEdges, type InventoryEdge } from "../api/trafficApi";
import { fetchMyDevices, type DeviceResponse } from "../api/devicesApi";

type NodeLayout = {
  id: string;
  deviceId: number;
  label: string;
  x: number;
  y: number;
  monitoring_status: string;
  last_ml_status: string | null;
};

function layoutNodes(devices: DeviceResponse[]): NodeLayout[] {
  const cols = 4;
  const gapX = 140;
  const gapY = 90;
  const startX = 90;
  const startY = 80;
  return devices.map((device, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      id: `device-${device.id}`,
      deviceId: device.id,
      label: device.name,
      x: startX + col * gapX,
      y: startY + row * gapY,
      monitoring_status: device.monitoring_status,
      last_ml_status: device.last_ml_status
    };
  });
}

/** Display-only stroke for backend monitoring_status (no security inference). */
function monitoringStroke(status: string): string {
  switch (status) {
    case "under_attack":
      return "#f43f5e";
    case "suspicious":
      return "#f59e0b";
    case "offline":
      return "#64748b";
    case "active":
    default:
      return "#2563eb";
  }
}

export function OtInventoryPage() {
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [edges, setEdges] = useState<InventoryEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [rows, e] = await Promise.all([fetchMyDevices(), fetchInventoryEdges(168)]);
        if (!active) return;
        setDevices(rows);
        setEdges(e);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load inventory.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const nodes = useMemo(() => layoutNodes(devices), [devices]);
  const map = useMemo(() => new Map(nodes.map((n) => [n.deviceId, n])), [nodes]);
  const edgePairs = useMemo(() => {
    const list: Array<{ a: NodeLayout; b: NodeLayout; packets: number }> = [];
    for (const e of edges) {
      const na = map.get(e.device_a_id);
      const nb = map.get(e.device_b_id);
      if (na && nb) {
        list.push({ a: na, b: nb, packets: e.packet_count });
      }
    }
    return list;
  }, [edges, map]);

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.16em] text-brand">Inventory</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">OT inventory</h1>
        <p className="mt-1 text-sm text-muted">
          Device nodes show backend <code className="text-violet-200">monitoring_status</code> and last ML status.
          Links are drawn only when flows in the last 7d correlate two inventory IPs for the same owner — not a full
          topology map.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1630] p-3">
        {loading ? <p className="text-sm text-muted">Loading…</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {!loading && !error && !nodes.length ? (
          <p className="text-sm text-muted">No devices found for this user.</p>
        ) : null}
        <svg viewBox="0 0 600 340" className="h-[340px] w-full">
          <defs>
            <linearGradient id="invLineGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {edgePairs.map(({ a, b, packets }) => (
            <g key={`${a.id}-${b.id}`}>
              <title>{`Observed flows (packet sum): ${packets.toLocaleString()}`}</title>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="url(#invLineGlow)" strokeWidth="1.5" />
            </g>
          ))}

          {nodes.map((node, i) => (
            <g key={node.id}>
              <title>{`${node.label}\nmonitoring_status: ${node.monitoring_status}\nlast_ml_status: ${node.last_ml_status ?? "—"}`}</title>
              <motion.circle
                cx={node.x}
                cy={node.y}
                r="22"
                fill="none"
                stroke={monitoringStroke(node.monitoring_status)}
                strokeWidth="4"
                opacity="0.95"
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 3 + i * 0.3, repeat: Infinity, ease: "easeInOut" }}
              />
              <circle cx={node.x} cy={node.y} r="18" fill="#0f172a" stroke="#334155" strokeWidth="1" />
              <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fill="#e2e8f0">
                {node.monitoring_status.slice(0, 3)}
              </text>
              <text x={node.x} y={node.y + 50} textAnchor="middle" fontSize="12" fill="#cbd5e1">
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
