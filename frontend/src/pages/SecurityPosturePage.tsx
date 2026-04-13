import { useEffect, useMemo, useState } from "react";

import { fetchSecurityPosture, type SecurityPosture } from "../api/phase2Api";

export function SecurityPosturePage() {
  const [payload, setPayload] = useState<SecurityPosture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const data = await fetchSecurityPosture();
        if (!active) return;
        setPayload(data);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load security posture.");
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
  }, []);

  const metrics = useMemo(
    () => [
      { label: "System Uptime", value: payload?.system_uptime ?? "N/A" },
      { label: "Blocked IPs Today", value: String(payload?.blocked_ips_today ?? 0) },
      { label: "Failed Logins", value: String(payload?.failed_logins ?? 0) },
      { label: "Model Drift", value: payload?.model_drift ?? "Monitoring" }
    ],
    [payload]
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.16em] text-brand">SP Page</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">Security Posture</h1>
      <p className="mt-1 text-sm text-muted">Overall resilience indicators and SOC health status.</p>

      {loading ? <p className="mt-4 text-sm text-muted">Loading security posture...</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-muted">{metric.label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{metric.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
