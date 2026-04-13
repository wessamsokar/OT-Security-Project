import { useEffect, useState } from "react";

import { fetchMttr, type MttrSummary } from "../api/phase2Api";

export function MttrPage() {
  const [payload, setPayload] = useState<MttrSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const data = await fetchMttr();
        if (!active) return;
        setPayload(data);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load MTTR insights.");
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

  const incidents = payload?.incidents ?? [];

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.16em] text-brand">Mttr Page</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">MTTR</h1>
      <p className="mt-1 text-sm text-muted">Mean Time To Respond for incidents in the current monitoring window.</p>

      {loading ? <p className="mt-4 text-sm text-muted">Loading MTTR...</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Average MTTR</p>
          <p className="mt-2 text-3xl font-semibold text-white">{payload?.average_mttr_minutes ?? 0}m</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Target SLA</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-200">{`<= ${payload?.target_sla_minutes ?? 20}m`}</p>
        </article>
      </div>

      <div className="mt-5 space-y-3">
        {incidents.map((incident) => (
          <div key={incident.incident_id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
            <p className="text-white">{incident.incident_id}</p>
            <p className="mt-1 text-muted">
              Opened: {new Date(incident.opened_at).toLocaleString()} | Resolved: {incident.resolved_at ? new Date(incident.resolved_at).toLocaleString() : "Open"} | MTTR: {incident.mttr_minutes}m
            </p>
          </div>
        ))}
        {!loading && !incidents.length ? <p className="text-sm text-muted">No incident records available yet.</p> : null}
      </div>
    </section>
  );
}
