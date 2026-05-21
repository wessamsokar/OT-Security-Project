import { memo, useMemo } from "react";
import { AlertTriangle, Radar, ShieldAlert, Siren } from "lucide-react";

import type { AlertResponse, DashboardSummary } from "../../api/alertsApi";
import type { ActiveThreat } from "../../api/phase2Api";

const severityColors = {
  critical: "border-rose-600/50 bg-rose-500/20 text-rose-200 animate-pulse ring-1 ring-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)]",
  high: "border-orange-500/30 bg-orange-500/15 text-orange-300",
  medium: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  low: "border-slate-500/30 bg-slate-500/15 text-slate-300",
};

type Props = {
  alerts: AlertResponse[];
  activeThreats: ActiveThreat[];
  dashboard: DashboardSummary | null;
  anomalousAssets: number;
  loading: boolean;
  error: string;
};

export const ThreatOperationsPanel = memo(function ThreatOperationsPanel({
  alerts,
  activeThreats,
  dashboard,
  anomalousAssets,
  loading,
  error
}: Props) {
  const topCategories = useMemo(() => {
    const dist = dashboard?.class_distribution ?? {};
    return Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [dashboard]);

  const suspiciousFlows = useMemo(() => {
    const dist = dashboard?.ml_status_distribution ?? {};
    const suspicious = (dist.suspicious ?? 0) + (dist.under_attack ?? 0);
    return suspicious;
  }, [dashboard]);

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-brand">Threat operations</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Active detections</h3>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted">
          <Siren size={14} />
          {loading ? "Scanning" : `${activeThreats.length} active`}
        </div>
      </header>

      {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}

      {loading ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-24 rounded-2xl border border-white/5 bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : null}

      {!loading ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <article className="group rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors duration-300 hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted">
              <ShieldAlert size={14} className="text-brand/70" />
              Active detections
            </div>
            <div className="mt-4 flex items-baseline">
              <span className="text-3xl font-light text-white">{activeThreats.length.toLocaleString()}</span>
            </div>
          </article>
          <article className="group rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors duration-300 hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted">
              <AlertTriangle size={14} className="text-brand/70" />
              Suspicious flows
            </div>
            <div className="mt-4 flex items-baseline">
              <span className="text-3xl font-light text-white">{suspiciousFlows.toLocaleString()}</span>
            </div>
          </article>
          <article className="group rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors duration-300 hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted">
              <Radar size={14} className="text-brand/70" />
              Anomalous assets
            </div>
            <div className="mt-4 flex items-baseline">
              <span className="text-3xl font-light text-white">{anomalousAssets.toLocaleString()}</span>
            </div>
          </article>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Attack categories</p>
          <div className="mt-4 space-y-3 text-sm">
            {topCategories.length > 0 ? (
              topCategories.map(([label, count]) => (
                <div key={label} className="flex items-center justify-between text-white border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-sm text-muted">{count.toLocaleString()}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No classified threats yet.</p>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Latest detections</p>
          <div className="mt-4 space-y-4">
            {alerts.length > 0 ? (
              alerts.slice(0, 4).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-white font-medium">{alert.summary}</p>
                    <p className="text-xs text-muted">{new Date(alert.created_at).toLocaleTimeString()}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${severityColors[alert.severity]}`}>
                    {alert.severity}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No alerts in the current window.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});
