import { memo, useMemo } from "react";
import { Layers, Network, PlugZap, Share2 } from "lucide-react";

import type { DeviceResponse } from "../../api/devicesApi";
import type { TopologyEdgeActivity, TopologyEdgeRecord } from "../../api/topologyApi";

const ZONE_KEY = "network_zone";

type Props = {
  devices: DeviceResponse[];
  edges: TopologyEdgeRecord[];
  edgeActivity: Map<number, TopologyEdgeActivity>;
  loading: boolean;
};

export const TopologyHealthPanel = memo(function TopologyHealthPanel({ devices, edges, edgeActivity, loading }: Props) {
  const stats = useMemo(() => {
    const edgesByDevice = new Map<number, { total: number; active: number }>();
    const markEdge = (deviceId: number, isActive: boolean) => {
      const current = edgesByDevice.get(deviceId) ?? { total: 0, active: 0 };
      current.total += 1;
      if (isActive) current.active += 1;
      edgesByDevice.set(deviceId, current);
    };

    edges.forEach((edge) => {
      const activity = edgeActivity.get(edge.id);
      const active = Boolean(activity?.active ?? edge.is_active);
      markEdge(edge.source_device_id, active);
      markEdge(edge.target_device_id, active);
    });

    let orphanDevices = 0;
    let disconnectedAssets = 0;
    let assetsNoTelemetry = 0;
    let isolatedPlcs = 0;

    const zoneStats = new Map<string, { total: number; active: number }>();

    devices.forEach((device) => {
      const edgeStats = edgesByDevice.get(device.id) ?? { total: 0, active: 0 };
      if (edgeStats.total === 0) orphanDevices += 1;
      if (edgeStats.active === 0) disconnectedAssets += 1;

      const state = (device.operational_state || "unknown").toLowerCase();
      const telemetryMissing =
        !device.last_traffic_at || state === "offline" || state === "unknown" || state === "inactive";
      if (telemetryMissing) assetsNoTelemetry += 1;

      const isPlc = String(device.device_type || "").toLowerCase().includes("plc");
      if (isPlc && edgeStats.active === 0) isolatedPlcs += 1;

      const zone = String((device.metadata_json as Record<string, unknown>)?.[ZONE_KEY] ?? "Unassigned");
      const zoneEntry = zoneStats.get(zone) ?? { total: 0, active: 0 };
      zoneEntry.total += 1;
      const isActive = state === "online" || state === "capture_enabled" || state === "degraded" || state === "anomalous";
      if (isActive) zoneEntry.active += 1;
      zoneStats.set(zone, zoneEntry);
    });

    const inactiveZones = Array.from(zoneStats.entries()).filter(([_, stats]) => stats.total > 0 && stats.active === 0).length;

    const staleEdges = edges.filter((edge) => {
      const activity = edgeActivity.get(edge.id);
      const active = Boolean(activity?.active ?? edge.is_active);
      return !active;
    }).length;

    return {
      orphanDevices,
      disconnectedAssets,
      staleEdges,
      inactiveZones,
      assetsNoTelemetry,
      isolatedPlcs
    };
  }, [devices, edges, edgeActivity]);

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-brand">Topology awareness</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Topology health insights</h3>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted">
          <Share2 size={14} />
          {loading ? "Analyzing" : `${edges.length.toLocaleString()} edges`}
        </div>
      </header>

      {loading ? (
        <div className="mt-5 grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-28 rounded-2xl border border-white/5 bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : null}

      {!loading ? (
        <div className="mt-5 grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <article className="group rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors duration-300 hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted">
              <Network size={12} className="text-brand/70" />
              Disconnected
            </div>
            <div className="mt-4 flex items-baseline">
              <span className="text-3xl font-light text-white">{stats.disconnectedAssets.toLocaleString()}</span>
            </div>
          </article>
          <article className="group rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors duration-300 hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted">
              <Layers size={12} className="text-brand/70" />
              Stale edges
            </div>
            <div className="mt-4 flex items-baseline">
              <span className="text-3xl font-light text-white">{stats.staleEdges.toLocaleString()}</span>
            </div>
          </article>
          <article className="group rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors duration-300 hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted">
              <PlugZap size={12} className="text-brand/70" />
              Orphan devices
            </div>
            <div className="mt-4 flex items-baseline">
              <span className="text-3xl font-light text-white">{stats.orphanDevices.toLocaleString()}</span>
            </div>
          </article>
          <article className="group rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors duration-300 hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted">
              Inactive zones
            </div>
            <div className="mt-4 flex items-baseline">
              <span className="text-3xl font-light text-white">{stats.inactiveZones.toLocaleString()}</span>
            </div>
          </article>
          <article className="group rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors duration-300 hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted">
              No telemetry
            </div>
            <div className="mt-4 flex items-baseline">
              <span className="text-3xl font-light text-white">{stats.assetsNoTelemetry.toLocaleString()}</span>
            </div>
          </article>
          <article className="group rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors duration-300 hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted">
              Isolated PLCs
            </div>
            <div className="mt-4 flex items-baseline">
              <span className="text-3xl font-light text-white">{stats.isolatedPlcs.toLocaleString()}</span>
            </div>
          </article>
        </div>
      ) : null}

      {!loading && devices.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No topology assets yet. Add devices to populate the graph.</p>
      ) : null}
    </section>
  );
});
