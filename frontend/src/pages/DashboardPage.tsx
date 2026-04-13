import { useEffect, useMemo, useState } from "react";

import { fetchAlerts, fetchDashboardSummary, type AlertResponse, type DashboardSummary } from "../api/alertsApi";
import { fetchModelVersions } from "../api/modelApi";
import { connectAlertsStream } from "../api/streamApi";
import { getAuthSession } from "../lib/authSession";

type TrafficPoint = {
  label: string;
  value: number;
  kind: "normal" | "suspicious" | "attack";
};

function severityClasses(severity: "High" | "Medium" | "Low") {
  if (severity === "High") return "bg-rose-500/20 text-rose-300";
  if (severity === "Medium") return "bg-amber-500/20 text-amber-300";
  return "bg-emerald-500/20 text-emerald-300";
}

function trafficClasses(kind: TrafficPoint["kind"]) {
  if (kind === "attack") return "bg-rose-500";
  if (kind === "suspicious") return "bg-amber-500";
  return "bg-sky-500";
}

function labelKind(label: string): TrafficPoint["kind"] {
  const lowered = label.toLowerCase();
  if (lowered.includes("flood") || lowered.includes("dos") || lowered.includes("attack")) return "attack";
  if (lowered.includes("scan") || lowered.includes("recon") || lowered.includes("unknown")) return "suspicious";
  return "normal";
}

function logClasses(severity: AlertResponse["severity"]) {
  if (severity === "critical" || severity === "high") return "text-rose-200";
  if (severity === "medium") return "text-amber-200";
  return "text-emerald-200";
}

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<AlertResponse[]>([]);
  const [mlConfidence, setMlConfidence] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const extractConfidence = (metrics: Record<string, unknown>): number => {
      const keys = ["confidence", "confidence_pct", "overall_confidence", "f1", "accuracy"];
      for (const key of keys) {
        const value = metrics[key];
        if (typeof value === "number") {
          return value <= 1 ? value * 100 : value;
        }
      }
      return 0;
    };

    const load = async () => {
      try {
        const [dashboardData, alertData, versions] = await Promise.all([
          fetchDashboardSummary(),
          fetchAlerts(),
          fetchModelVersions()
        ]);

        if (!active) return;
        const activeModel = versions.find((version) => version.is_active) ?? versions[0] ?? null;
        setSummary(dashboardData);
        setAlerts(alertData);
        setMlConfidence(extractConfidence(activeModel?.metrics_json ?? {}));
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load dashboard metrics right now.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    const stream = connectAlertsStream(
      (snapshot) => {
        if (!active) return;
        setSummary(snapshot.dashboard);
        setAlerts(snapshot.alerts);
        setMlConfidence(snapshot.ml_confidence);
        setError("");
        setLoading(false);
      },
      () => {
        if (!active) return;
        setError("Live stream disconnected. Showing latest available dashboard snapshot.");
      }
    );

    return () => {
      active = false;
      stream?.close();
    };
  }, []);

  const session = getAuthSession();
  const welcomeName = session?.user.fullName ?? "Security Analyst";
  const firstName = welcomeName.split(" ")[0] ?? "Analyst";

  const packetCount = summary?.total_records ?? 0;
  const totalAlertsToday = summary?.total_alerts ?? 0;
  const activeThreats = useMemo(() => {
    return alerts.filter((item) => item.severity === "critical" || item.severity === "high").length;
  }, [alerts]);
  const meanRiskPct = ((summary?.avg_risk_score ?? 0) * 100).toFixed(1);

  const trafficSeries: TrafficPoint[] = useMemo(
    () =>
      Object.entries(summary?.class_distribution ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([label, value]) => ({
          label,
          value,
          kind: labelKind(label)
        })),
    [summary]
  );

  const topClasses = trafficSeries.slice(0, 3);

  return (
    <section className="space-y-5 rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/10 to-white/5 p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-brand">User Dashboard</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Welcome back, {firstName}</h1>
        <p className="mt-1 text-sm text-muted">Assigned SOC view with real-time alerts, traffic, tasks, and security posture.</p>
      </div>

      {loading ? <p className="text-sm text-muted">Loading dashboard data...</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Packets Analysed</p>
          <p className="mt-2 text-3xl font-semibold text-white">{packetCount.toLocaleString()}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Total Alerts Today</p>
          <p className="mt-2 text-3xl font-semibold text-white">{totalAlertsToday}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Active Threats</p>
          <p className="mt-2 text-3xl font-semibold text-rose-200">{activeThreats}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-muted">MTTR</p>
          <p className="mt-2 text-3xl font-semibold text-white">Pending</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-muted">ML Confidence</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-200">{mlConfidence.toFixed(1)}%</p>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-white">Network Traffic (Last 12 Hours)</h2>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" /> Normal</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Suspicious</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Attack</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-12 items-end gap-2">
            {trafficSeries.map((point) => (
              <div key={point.label} className="flex flex-col items-center gap-2">
                <div className="flex h-36 w-full max-w-8 items-end rounded-sm bg-background/40 p-[2px]">
                  <div
                    className={`w-full rounded-sm ${trafficClasses(point.kind)}`}
                    style={{ height: `${Math.max(8, Math.min(100, Math.round((point.value / Math.max(1, packetCount)) * 900)))}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted">{point.label.slice(0, 6)}</span>
              </div>
            ))}
            {!trafficSeries.length ? <p className="col-span-12 text-sm text-muted">No class distribution data yet.</p> : null}
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-medium text-white">My Tasks</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-xl border border-white/10 bg-background/40 p-3">
              <p className="text-white">Investigate Modbus Injection on PLC-01</p>
              <p className="mt-1 text-xs text-muted">SLA: 12m remaining</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-background/40 p-3">
              <p className="text-white">Review replay anomaly at HMI-02</p>
              <p className="mt-1 text-xs text-muted">SLA: 26m remaining</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-background/40 p-3">
              <p className="text-white">Confirm whitelist for inventory scanner</p>
              <p className="mt-1 text-xs text-muted">SLA: 41m remaining</p>
            </div>
          </div>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-medium text-white">Live Alerts</h2>
          <div className="mt-3 space-y-2">
            {alerts.slice(0, 6).map((alert) => (
              <div key={alert.id} className="rounded-xl border border-white/10 bg-background/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-white">{alert.summary}</p>
                    <p className="mt-1 text-xs text-muted">Traffic Record: {alert.traffic_record_id}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${severityClasses(alert.severity === "critical" ? "High" : alert.severity === "high" ? "High" : alert.severity === "medium" ? "Medium" : "Low")}`}>{alert.severity.toUpperCase()}</span>
                </div>
                <p className="mt-2 text-xs text-muted">{new Date(alert.created_at).toLocaleString()}</p>
              </div>
            ))}
            {!alerts.length ? <p className="text-sm text-muted">No live alerts yet.</p> : null}
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-medium text-white">Recent Detections</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="pb-2 pr-3">Timestamp</th>
                  <th className="pb-2 pr-3">Alert</th>
                  <th className="pb-2 pr-3">Record</th>
                  <th className="pb-2">Severity</th>
                </tr>
              </thead>
              <tbody>
                {alerts.slice(0, 8).map((alert) => (
                  <tr key={alert.id} className="border-t border-white/10">
                    <td className="py-2 pr-3 text-muted">{new Date(alert.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-muted">{alert.summary}</td>
                    <td className="py-2 pr-3 text-muted">{alert.traffic_record_id}</td>
                    <td className={`py-2 font-medium ${logClasses(alert.severity)}`}>{alert.severity.toUpperCase()}</td>
                  </tr>
                ))}
                {!alerts.length ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-muted">No detections recorded yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-medium text-white">Top Attack Classes</h2>
          <div className="mt-3 space-y-2 text-sm">
            {topClasses.map((entry) => (
              <div key={entry.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-background/40 px-3 py-2">
                <span className="text-white">{entry.label}</span>
                <span className="text-rose-200">{entry.value} flows</span>
              </div>
            ))}
            {!topClasses.length ? <p className="text-muted">No class data available yet.</p> : null}
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-medium text-white">Security Posture</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-white/10 bg-background/40 p-3">
              <p className="text-xs text-muted">Incidents Open</p>
              <p className="mt-1 text-white">{summary?.incidents_open ?? 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-background/40 p-3">
              <p className="text-xs text-muted">Avg Risk Score</p>
              <p className="mt-1 text-white">{meanRiskPct}%</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-background/40 p-3">
              <p className="text-xs text-muted">Alerts</p>
              <p className="mt-1 text-white">{totalAlertsToday}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-background/40 p-3">
              <p className="text-xs text-muted">Model Drift</p>
              <p className="mt-1 text-emerald-200">Monitoring</p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
