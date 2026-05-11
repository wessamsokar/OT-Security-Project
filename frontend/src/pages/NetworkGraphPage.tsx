import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { fetchMyDevices, type DeviceResponse } from "../api/devicesApi";

type GraphNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  status: "online" | "warning";
};

type GraphLink = [string, string];

function buildGraph(devices: DeviceResponse[]): { nodes: GraphNode[]; links: GraphLink[] } {
  const cols = 4;
  const gapX = 140;
  const gapY = 90;
  const startX = 90;
  const startY = 80;

  const nodes: GraphNode[] = devices.map((device, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const status: GraphNode["status"] = device.is_active ? "online" : "warning";
    return {
      id: `device-${device.id}`,
      label: device.name,
      x: startX + col * gapX,
      y: startY + row * gapY,
      status
    };
  });

  const links: GraphLink[] = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    links.push([nodes[i].id, nodes[i + 1].id]);
  }

  return { nodes, links };
}

export function NetworkGraphPage() {
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const rows = await fetchMyDevices();
        if (!active) return;
        setDevices(rows);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load devices.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const { nodes, links } = useMemo(() => buildGraph(devices), [devices]);
  const map = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.16em] text-brand">Network</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Network Graph</h1>
        <p className="mt-1 text-sm text-muted">Real-time topology of connected OT devices and communication links.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1630] p-3">
        {loading ? <p className="text-sm text-muted">Loading devices...</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {!loading && !error && !nodes.length ? (
          <p className="text-sm text-muted">No devices found for this user.</p>
        ) : null}
        <svg viewBox="0 0 600 340" className="h-[340px] w-full">
          <defs>
            <linearGradient id="lineGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {links.map(([a, b], i) => {
            const n1 = map.get(a);
            const n2 = map.get(b);
            if (!n1 || !n2) {
              return null;
            }

            return (
              <g key={`${a}-${b}`}>
                <line x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke="url(#lineGlow)" strokeWidth="2" />
                <motion.circle
                  cx={n1.x + (n2.x - n1.x) * 0.5}
                  cy={n1.y + (n2.y - n1.y) * 0.5}
                  r="2.5"
                  fill="#7dd3fc"
                  animate={{ opacity: [0.25, 1, 0.25], scale: [0.9, 1.4, 0.9] }}
                  transition={{ duration: 2 + i * 0.2, repeat: Infinity, ease: "easeInOut" }}
                />
              </g>
            );
          })}

          {nodes.map((node, i) => (
            <g key={node.id}>
              <motion.circle
                cx={node.x}
                cy={node.y}
                r="22"
                fill={node.status === "warning" ? "#f59e0b" : "#1d4ed8"}
                opacity="0.95"
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 3 + i * 0.3, repeat: Infinity, ease: "easeInOut" }}
              />
              <circle cx={node.x} cy={node.y} r="32" fill="none" stroke="#60a5fa" strokeOpacity="0.2" />
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
