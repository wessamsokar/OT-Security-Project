import { useEffect, useMemo, useState } from "react";

import { fetchAlerts, type AlertResponse } from "../api/alertsApi";
import { connectAlertsStream } from "../api/streamApi";

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const rows = await fetchAlerts();
        if (!active) return;
        setAlerts(rows);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load alerts right now.");
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
        setAlerts(snapshot.alerts);
        setError("");
        setLoading(false);
      },
      () => {
        if (!active) return;
        setError("Live stream disconnected. Showing latest available alerts.");
      }
    );

    return () => {
      active = false;
      stream?.close();
    };
  }, []);

  const counts = useMemo(() => {
    return alerts.reduce(
      (acc, alert) => {
        if (alert.severity === "critical" || alert.severity === "high") acc.high += 1;
        if (alert.severity === "medium") acc.medium += 1;
        if (alert.severity === "low") acc.low += 1;
        return acc;
      },
      { high: 0, medium: 0, low: 0 }
    );
  }, [alerts]);

  const severityClass = (severity: AlertResponse["severity"]) => {
    if (severity === "critical" || severity === "high") return "bg-rose-500/20 text-rose-300";
    if (severity === "medium") return "bg-amber-500/20 text-amber-300";
    return "bg-emerald-500/20 text-emerald-300";
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.16em] text-brand">Alerts Page</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">Alerts</h1>
      <p className="mt-1 text-sm text-muted">Focused alert management for current operator shift.</p>

      {loading ? <p className="mt-4 text-sm text-muted">Loading alerts...</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-muted">High</p><p className="mt-2 text-3xl font-semibold text-rose-200">{counts.high}</p></article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-muted">Medium</p><p className="mt-2 text-3xl font-semibold text-amber-200">{counts.medium}</p></article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-muted">Low</p><p className="mt-2 text-3xl font-semibold text-emerald-200">{counts.low}</p></article>
      </div>

      <div className="mt-5 space-y-3">
        {alerts.map((alert) => (
          <div key={alert.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-white">A-{alert.id} - {alert.summary}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs ${severityClass(alert.severity)}`}>{alert.severity.toUpperCase()}</span>
            </div>
            <p className="mt-1 text-xs text-muted">Traffic Record: {alert.traffic_record_id} | Time: {new Date(alert.created_at).toLocaleString()}</p>
          </div>
        ))}
        {!loading && !alerts.length ? <p className="text-sm text-muted">No alerts yet.</p> : null}
      </div>
    </section>
  );
}
