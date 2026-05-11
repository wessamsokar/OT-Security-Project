import { useEffect, useState } from "react";

import { fetchSocHealth, type SocHealthPayload } from "../api/phase2Api";

function countEntries(map: Record<string, number> | undefined): [string, number][] {
  if (!map) return [];
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

export function SocHealthPage() {
  const [payload, setPayload] = useState<SocHealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const data = await fetchSocHealth();
        if (!active) return;
        setPayload(data);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load SOC health.");
      } finally {
        if (active) setLoading(false);
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
  }, []);

  const mlRows = countEntries(payload?.ml_status_counts);
  const sevRows = countEntries(payload?.alerts_severity_counts);
  const monRows = countEntries(payload?.monitoring_status_counts);

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.16em] text-brand">SOC health</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">SOC health dashboard</h1>
      <p className="mt-1 text-sm text-muted">
        Rolling {payload?.window_hours ?? 24}h window: ML verdict counts on traffic, alert severities from the alert
        pipeline, and device monitoring state from the backend (no client-side risk scoring).
      </p>

      {loading ? <p className="mt-4 text-sm text-muted">Loading…</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Flows in window</p>
          <p className="mt-2 text-3xl font-semibold text-white">{(payload?.traffic_flows_in_window ?? 0).toLocaleString()}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Flows with ML attack_detected</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {(payload?.traffic_attack_detected_count ?? 0).toLocaleString()}
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Avg last_ml_risk_score (devices)</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {payload?.avg_last_ml_risk_score != null ? payload.avg_last_ml_risk_score.toFixed(3) : "—"}
          </p>
        </article>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-medium text-white">ml_status (traffic)</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {mlRows.map(([k, v]) => (
              <li key={k} className="flex justify-between gap-2 text-muted">
                <span className="text-white">{k}</span>
                <span>{v.toLocaleString()}</span>
              </li>
            ))}
            {!loading && !mlRows.length ? <li className="text-muted">No traffic in window.</li> : null}
          </ul>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-medium text-white">Alert severity (window)</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {sevRows.map(([k, v]) => (
              <li key={k} className="flex justify-between gap-2 text-muted">
                <span className="text-white">{k}</span>
                <span>{v.toLocaleString()}</span>
              </li>
            ))}
            {!loading && !sevRows.length ? <li className="text-muted">No alerts in window.</li> : null}
          </ul>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-medium text-white">monitoring_status (devices)</h2>
          <p className="mt-1 text-xs text-muted">Registered devices: {payload?.devices_registered ?? 0}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {monRows.map(([k, v]) => (
              <li key={k} className="flex justify-between gap-2 text-muted">
                <span className="text-white">{k}</span>
                <span>{v.toLocaleString()}</span>
              </li>
            ))}
            {!loading && !monRows.length ? <li className="text-muted">No devices.</li> : null}
          </ul>
        </article>
      </div>
    </section>
  );
}
