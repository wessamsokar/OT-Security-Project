import { useEffect, useState } from "react";

import { fetchPacketsByHour, type PacketsByHourResponse } from "../api/phase2Api";
import { useTenant } from "../contexts/TenantContext";

/**
 * Traffic Telemetry Page — Packets Analysed
 *
 * Metric display clarity:
 *   "Network Packets (24h)" = SUM(TrafficRecord.packet_count) — actual network packets.
 *                             One flow record may represent many packets.
 *
 *   "Flow Records (24h)"    = COUNT(TrafficRecord rows) — telemetry records ingested.
 *                             Each row is one network flow observed by a sensor.
 *
 *   "Avg pkts/min"          = Network packets / actual elapsed minutes (not hardcoded 24*60).
 *
 * These are explicitly different metrics and should never be shown under the same label.
 */
export function PacketsAnalysedPage() {
  const [payload, setPayload] = useState<PacketsByHourResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { activeTenantId, canSelectTenant, assignedCustomers, isLoadingAssignments } = useTenant();
  const tenantId = canSelectTenant ? activeTenantId : undefined;

  useEffect(() => {
    let active = true;

    if (canSelectTenant && isLoadingAssignments) {
      return () => {
        active = false;
      };
    }

    if (canSelectTenant && assignedCustomers.length === 0) {
      setError("No customer tenants assigned. Contact an administrator.");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const load = async () => {
      try {
        const data = await fetchPacketsByHour(tenantId);
        if (!active) return;
        setPayload(data);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load packets analytics.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [tenantId, canSelectTenant, isLoadingAssignments, assignedCustomers.length]);

  const rows = payload?.rows ?? [];

  // packet_count_total = SUM of actual network packets (may be >> flow count)
  const packetTotal = payload?.packet_count_total ?? payload?.today_total ?? 0;
  // flow_count_total = COUNT of telemetry flow records ingested
  const flowTotal = payload?.flow_count_total ?? 0;

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.16em] text-brand">Telemetry</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">Traffic Telemetry</h1>
      <p className="mt-1 text-sm text-muted">
        Ingested volume and protocol mix (last 24h). Operations signal only — not ML verdicts or threat inference.
      </p>

      {/* Metric legend */}
      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted">
        <span className="font-medium text-white">Network Packets</span> = actual packets carried across flows (SUM) ·{" "}
        <span className="font-medium text-white">Flow Records</span> = telemetry rows ingested (COUNT)
      </div>

      {loading ? <p className="mt-4 text-sm text-muted">Loading telemetry analytics...</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Network Packets (24h)</p>
          <p className="mt-2 text-3xl font-semibold text-white">{packetTotal.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted">SUM of TrafficRecord.packet_count</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Flow Records (24h)</p>
          <p className="mt-2 text-3xl font-semibold text-white">{flowTotal.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted">COUNT of telemetry rows</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Avg Pkts / Min</p>
          <p className="mt-2 text-3xl font-semibold text-white">{payload?.avg_per_minute ?? 0}</p>
          <p className="mt-1 text-xs text-muted">Rolling 24h average</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Peak Hour</p>
          <p className="mt-2 text-3xl font-semibold text-white">{payload?.peak_hour ?? "N/A"}</p>
          <p className="mt-1 text-xs text-muted">Highest packet volume</p>
        </article>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-muted">
            <tr>
              <th className="px-4 py-3">Hour (UTC)</th>
              <th className="px-4 py-3 text-right">
                Network Packets
                <span className="ml-1 font-normal opacity-60">(SUM)</span>
              </th>
              <th className="px-4 py-3 text-right">
                Flow Records
                <span className="ml-1 font-normal opacity-60">(COUNT)</span>
              </th>
              <th className="px-4 py-3">Dominant Protocol</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.hour} className="border-t border-white/10">
                <td className="px-4 py-3 text-white">{row.hour}</td>
                <td className="px-4 py-3 text-right text-muted">{row.packets.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-muted">{(row.flow_count ?? 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-muted">{row.dominant_protocol}</td>
              </tr>
            ))}
            {!loading && !rows.length ? (
              <tr className="border-t border-white/10">
                <td className="px-4 py-3 text-muted" colSpan={4}>No traffic records found in the last 24h.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
