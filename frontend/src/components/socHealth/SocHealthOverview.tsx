import { memo } from "react";
import { Activity, Database, Globe, Radar } from "lucide-react";

const STATUS_STYLES: Record<
  string,
  { label: string; dot: string; bg: string; text: string; pulse?: string }
> = {
  online: {
    label: "Online",
    dot: "bg-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    text: "text-emerald-300",
    pulse: "soc-pulse-emerald"
  },
  offline: {
    label: "Offline",
    dot: "bg-slate-400",
    bg: "bg-white/5 border-white/10",
    text: "text-slate-300"
  },
  degraded: {
    label: "Degraded",
    dot: "bg-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    text: "text-amber-300",
    pulse: "soc-pulse-amber"
  },
  anomalous: {
    label: "Anomalous",
    dot: "bg-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
    text: "text-rose-300",
    pulse: "soc-pulse-rose"
  },
  capture_enabled: {
    label: "Capture",
    dot: "bg-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    text: "text-violet-300",
    pulse: "soc-pulse-violet"
  }
};

type StatusCounts = {
  online: number;
  offline: number;
  degraded: number;
  anomalous: number;
  capture_enabled: number;
};

type StreamState = {
  alertsConnected: boolean;
  topologyConnected: boolean;
};

type Props = {
  counts: StatusCounts;
  total: number;
  lastTelemetryAt: string | null;
  streamState: StreamState;
  loading?: boolean;
};

export const SocHealthOverview = memo(function SocHealthOverview({
  counts,
  total,
  lastTelemetryAt,
  streamState,
  loading
}: Props) {
  const lastTelemetryLabel = lastTelemetryAt
    ? new Date(lastTelemetryAt).toLocaleString()
    : "No telemetry";

  const streamLabel = streamState.alertsConnected || streamState.topologyConnected ? "Live" : "Delayed";
  const streamTone = streamState.alertsConnected || streamState.topologyConnected ? "text-emerald-200" : "text-amber-200";
  const streamDot = streamState.alertsConnected || streamState.topologyConnected ? "bg-emerald-400" : "bg-amber-400";

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-panel/50 p-6 shadow-panel">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_60%)]" />
      <div className="relative flex flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand">Operational visibility</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">SOC Health Command Center</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Live device posture, topology awareness, telemetry ingestion, and threat monitoring powered by OT traffic.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className={`h-2.5 w-2.5 rounded-full ${streamDot} soc-pulse-live`} />
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted">SOC stream</p>
              <p className={`text-sm font-semibold ${streamTone}`}>{streamLabel}</p>
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-5">
          {Object.entries(STATUS_STYLES).map(([key, style]) => (
            <article key={key} className={`group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:bg-opacity-20 ${style.bg}`}>
              <div className="flex flex-col gap-3">
                <div className={`flex items-center gap-2 text-xs uppercase tracking-[0.18em] ${style.text}`}>
                  <span className={`h-2 w-2 rounded-full ${style.dot} ${style.pulse ?? ""}`} />
                  {style.label}
                </div>
                <span className="text-3xl font-light text-white">
                  {loading ? (
                    <div className="h-9 w-16 animate-pulse rounded bg-white/10" />
                  ) : (
                    counts[key as keyof StatusCounts].toLocaleString()
                  )}
                </span>
              </div>
            </article>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="group rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors duration-300 hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
              <Radar size={14} className="text-brand/70" />
              Devices tracked
            </div>
            <div className="mt-4 flex items-center">
              {loading ? (
                <div className="h-8 w-20 animate-pulse rounded bg-white/10" />
              ) : (
                <span className="text-3xl font-light text-white">{total.toLocaleString()}</span>
              )}
            </div>
          </div>
          <div className="group rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors duration-300 hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
              <Database size={14} className="text-brand/70" />
              Last telemetry
            </div>
            <div className="mt-4">
              {loading ? (
                <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
              ) : (
                <span className="text-sm font-medium text-white">{lastTelemetryLabel}</span>
              )}
            </div>
          </div>
          <div className="group rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors duration-300 hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
              <Activity size={14} className="text-brand/70" />
              Live monitoring
            </div>
            <div className="mt-4 flex flex-col gap-1 text-sm">
              <div className="flex items-center justify-between text-white">
                <span className="text-muted">Alerts</span>
                <span className={streamState.alertsConnected ? "text-emerald-300" : "text-amber-300"}>
                  {streamState.alertsConnected ? "Connected" : "Offline"}
                </span>
              </div>
              <div className="flex items-center justify-between text-white">
                <span className="text-muted">Topology</span>
                <span className={streamState.topologyConnected ? "text-emerald-300" : "text-amber-300"}>
                  {streamState.topologyConnected ? "Connected" : "Offline"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
          <Globe size={14} />
          OT telemetry window updates every 10-15s
        </div>
      </div>
    </section>
  );
});
