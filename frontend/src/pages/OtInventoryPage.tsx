import { useMemo } from "react";
import { Link } from "react-router-dom";

import type { DeviceResponse } from "../api/devicesApi";
import { Button } from "../components/ui/Button";
import { OT_META, resolveOperationalBadge } from "../components/devices/otAssetMetadata";
import { TopologyDetailsPanel } from "../components/topology/TopologyDetailsPanel";
import { TopologyBoundary } from "../components/topology/TopologyBoundary";
import { TopologyGraph } from "../components/topology/TopologyGraph";
import { buildTopologyEdges, buildTopologyNodes } from "../components/topology/topologyAdapter";
import { TopologyProvider, useTopologyStore } from "../components/topology/topologyStore";
import { useTopologyLive } from "../components/topology/useTopologyLive";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";

function protocolFromDevice(device: DeviceResponse): string | null {
  const meta = device.metadata_json ?? {};
  const raw = meta[OT_META.protocol];
  return typeof raw === "string" ? raw : null;
}

function formatTrafficVolume(total: number): string {
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M pkts`;
  if (total >= 1_000) return `${(total / 1_000).toFixed(1)}k pkts`;
  return `${total} pkts`;
}

function TopologyContent() {
  const { devices, edges, edgeActivity, selectedDeviceId, selectDevice, liveConnected } = useTopologyStore();
  const { hasPermission } = useAuth();
  const { activeTenantId, canSelectTenant, assignedCustomers, isLoadingAssignments } = useTenant();
  const tenantId = canSelectTenant ? activeTenantId : undefined;
  const isGlobal = hasPermission("manage_users") && activeTenantId === undefined;
  const { loading, error } = useTopologyLive(tenantId, {
    enabled: !canSelectTenant || (!isLoadingAssignments && assignedCustomers.length > 0)
  });
  const canCreateDevices = hasPermission("create_devices");

  const activityMap = useMemo(() => {
    const map = new Map<number, { active: boolean; packet_count: number }>();
    edgeActivity.forEach((item, edgeId) => {
      map.set(edgeId, { active: item.active, packet_count: item.packet_count });
    });
    return map;
  }, [edgeActivity]);

  const nodes = useMemo(() => buildTopologyNodes(devices), [devices]);
  const deviceIds = useMemo(() => new Set(devices.map((device) => device.id)), [devices]);
  const graphEdges = useMemo(() => buildTopologyEdges(edges, activityMap, deviceIds), [edges, activityMap, deviceIds]);
  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId]
  );

  const edgeStats = useMemo(() => {
    const map = new Map<number, { volume: number; connected: number[] }>();
    devices.forEach((device) => map.set(device.id, { volume: 0, connected: [] }));
    edges.forEach((edge) => {
      const a = map.get(edge.source_device_id);
      const b = map.get(edge.target_device_id);
      if (a) {
        a.volume += edge.packet_count;
        a.connected.push(edge.target_device_id);
      }
      if (b) {
        b.volume += edge.packet_count;
        b.connected.push(edge.source_device_id);
      }
    });
    return map;
  }, [devices, edges]);

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-brand">OT topology</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Live OT network visibility</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Live OT operational graph with server-derived status, persisted topology edges, and SSE updates. Graph and
            inventory table stay synchronized.
          </p>
          {liveConnected ? (
            <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live stream
            </span>
          ) : null}
        </div>
        {canCreateDevices ? (
          <Link to="/dashboard/devices">
            <Button>Register OT traffic source</Button>
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          {canSelectTenant && isLoadingAssignments ? (
            <p className="text-sm text-muted">Loading customer scope…</p>
          ) : null}
          {canSelectTenant && !isLoadingAssignments && assignedCustomers.length === 0 ? (
            <p className="text-sm text-muted">No customer tenants assigned.</p>
          ) : null}
          {loading ? <p className="text-sm text-muted">Loading topology…</p> : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {!loading && !error && !devices.length && !isGlobal ? (
            <p className="text-sm text-muted">No devices found for this tenant.</p>
          ) : null}
          {isGlobal ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-center">
              <div>
                <p className="text-sm text-muted">Global View</p>
                <p className="mt-1 text-sm font-medium text-white">Please select a customer environment to view topology.</p>
              </div>
            </div>
          ) : (
            <TopologyBoundary>
              <TopologyGraph nodes={nodes} edges={graphEdges} onSelectNode={selectDevice} />
            </TopologyBoundary>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Online
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-400" /> Offline
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-400" /> Unknown
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Degraded
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Anomalous
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-violet-400" /> Capture
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <TopologyDetailsPanel device={selectedDevice} />
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-muted">
            <p className="font-semibold text-white">Topology notes</p>
            <ul className="mt-2 space-y-1">
              <li>Edges are persisted in the topology store and animated when traffic is active.</li>
              <li>Operational state is derived on the server from telemetry timestamps and ML status.</li>
              <li>Phase 3 will add zone grouping, MITRE overlays, and attack-path propagation.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-muted">
            <tr>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">IP / Protocol</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last packet</th>
              <th className="px-4 py-3">Connected</th>
              <th className="px-4 py-3">Traffic volume</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => {
              const badge = resolveOperationalBadge(device);
              const stats = edgeStats.get(device.id);
              const connected = stats?.connected ?? [];
              const connectedNames = connected
                .map((id) => devices.find((d) => d.id === id)?.name)
                .filter(Boolean)
                .slice(0, 2)
                .join(", ");
              const protocol = protocolFromDevice(device);

              return (
                <tr key={device.id} className="border-t border-white/10">
                  <td className="px-4 py-3 text-white">
                    <button
                      type="button"
                      className="text-left hover:text-brand"
                      onClick={() => selectDevice(device.id)}
                    >
                      {device.name}
                    </button>
                    {isGlobal && device.tenant_name ? (
                      <span className="ml-2 inline-block rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-muted">
                        {device.tenant_name}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted">{device.device_type ?? "-"}</td>
                  <td className="px-4 py-3 text-muted">
                    {device.ip_address ?? "-"}{" "}
                    {protocol ? (
                      <span className="ml-1 inline-block rounded border border-white/10 bg-white/[0.04] px-1.5 py-px text-[10px] text-muted">
                        {protocol.replace(/_/g, " ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                        badge.className
                      ].join(" ")}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {device.last_traffic_at ? new Date(device.last_traffic_at).toLocaleString() : "No telemetry"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {connectedNames || "—"}
                    {connected.length > 2 ? ` +${connected.length - 2}` : ""}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatTrafficVolume(stats?.volume ?? 0)}
                  </td>
                </tr>
              );
            })}
            {!loading && !devices.length ? (
              <tr className="border-t border-white/10">
                <td className="px-4 py-3 text-muted" colSpan={7}>
                  No monitored traffic sources yet. Register one to begin OT telemetry ingestion.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function OtInventoryPage() {
  return (
    <TopologyProvider>
      <TopologyContent />
    </TopologyProvider>
  );
}
