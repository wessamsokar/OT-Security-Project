import { memo } from "react";
import { Activity, Signal, Timer, Wifi } from "lucide-react";

import type { TelemetryHealthResponse } from "../../api/trafficApi";

function statusTone(status: "healthy" | "degraded" | "stalled") {
  if (status === "healthy") return "text-emerald-400";
  if (status === "degraded") return "text-amber-400";
  return "text-rose-400";
}

function statusPulse(status: "healthy" | "degraded" | "stalled") {
  if (status === "healthy") return "bg-emerald-400 soc-pulse-emerald";
  if (status === "degraded") return "bg-amber-400 soc-pulse-amber";
  return "bg-rose-400";
}

type Props = {
  data: TelemetryHealthResponse | null;
  loading: boolean;
  error: string;
  alertsConnected: boolean;
  topologyConnected: boolean;
};

export const TelemetryHealthPanel = memo(function TelemetryHealthPanel({
  data,
  loading,
  error,
  alertsConnected,
  topologyConnected
}: Props) {
  const lastSeen = data?.last_traffic_at ? new Date(data.last_traffic_at) : null;
  const minutesSince = lastSeen ? Math.round((Date.now() - lastSeen.getTime()) / 60000) : null;
  const status = !lastSeen
    ? "stalled"
    : minutesSince != null && minutesSince <= 2
      ? "healthy"
      : minutesSince != null && minutesSince <= 10
        ? "degraded"
        : "stalled";

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel flex flex-col h-full">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-brand">Telemetry pipeline</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Ingestion health</h3>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-2">
          <div className={`h-2 w-2 rounded-full ${loading ? "bg-slate-400" : statusPulse(status)}`} />
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted">Status</span>
            <span className={`text-xs font-semibold uppercase tracking-wider ${loading ? "text-slate-400" : statusTone(status)}`}>
              {loading ? "Checking" : status}
            </span>
          </div>
        </div>
      </header>

      {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}

      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 flex-1">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-[104px] rounded-2xl border border-white/5 bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : null}

      {!loading && data ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 flex-1">
          <article className="group flex flex-col justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors duration-300 hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted">
              <Activity size={14} className="text-brand/70" />
              Throughput
            </div>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-3xl font-light leading-none text-white">
                {Math.round(data.avg_packets_per_minute_15m).toLocaleString()}
              </span>
              <span className="text-xs text-muted mb-0.5">pkts/min</span>
            </div>
          </article>
          
          <article className="group flex flex-col justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors duration-300 hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted">
              <Timer size={14} className="text-brand/70" />
              Freshness
            </div>
            <div className="mt-4 flex flex-col gap-1.5">
              <span className="text-xl font-light leading-none text-white">
                {minutesSince == null ? "Awaiting data" : minutesSince === 0 ? "Just now" : `${minutesSince} min ago`}
              </span>
              <span className="text-xs text-muted">
                {lastSeen ? lastSeen.toLocaleTimeString() : "No telemetry"}
              </span>
            </div>
          </article>

          <article className="group flex flex-col justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors duration-300 hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted">
              <Signal size={14} className="text-brand/70" />
              Alerts Stream
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full ${alertsConnected ? "bg-emerald-400 soc-pulse-emerald" : "bg-rose-400"}`} />
              <span className={`text-lg font-light leading-none ${alertsConnected ? "text-white" : "text-rose-200"}`}>
                {alertsConnected ? "Connected" : "Offline"}
              </span>
            </div>
          </article>

          <article className="group flex flex-col justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors duration-300 hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted">
              <Signal size={14} className="text-brand/70" />
              Topology Stream
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full ${topologyConnected ? "bg-emerald-400 soc-pulse-emerald" : "bg-rose-400"}`} />
              <span className={`text-lg font-light leading-none ${topologyConnected ? "text-white" : "text-rose-200"}`}>
                {topologyConnected ? "Connected" : "Offline"}
              </span>
            </div>
          </article>
        </div>
      ) : null}

      {!loading && !data ? (
        <div className="mt-6 flex-1 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
          <div className="flex items-center gap-2">
            <Wifi size={16} />
            No telemetry health yet. Connect a sensor or ingest traffic to activate this panel.
          </div>
        </div>
      ) : null}
    </section>
  );
});
