import { useEffect, useMemo, useState } from "react";

import { fetchPublicLiveSnapshot, type LiveSnapshotResponse } from "../api/publicApi";

type Variant = "compact" | "full";

type Props = {
  variant?: Variant;
  pollIntervalMs?: number;
};

export function LiveThreatSnapshot({ variant = "full", pollIntervalMs = 15000 }: Props) {
  const [summary, setSummary] = useState<LiveSnapshotResponse["dashboard"] | null>(null);
  const [threats, setThreats] = useState<LiveSnapshotResponse["active_threats"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const snapshot = await fetchPublicLiveSnapshot();
        if (!active) return;
        setSummary(snapshot.dashboard);
        setThreats(snapshot.active_threats);
        setUpdatedAt(new Date(snapshot.updated_at));
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load live snapshot.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, pollIntervalMs);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pollIntervalMs]);

  const avgRiskPct = useMemo(() => ((summary?.avg_risk_score ?? 0) * 100).toFixed(1), [summary]);
  const activeThreats = threats.length;

  if (variant === "compact") {
    return (
      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#101b3d]/70 to-[#0a1228]/58 p-7 shadow-panel">
        <p className="text-xs uppercase tracking-[0.18em] text-brand">Live Threat Snapshot</p>
        <h3 className="mt-3 text-lg font-semibold text-white">Public OT dashboard</h3>
        {loading ? <p className="mt-3 text-sm text-muted">Loading snapshot...</p> : null}
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-6 grid gap-4">
          {[
            ["Active threats", String(activeThreats)],
            ["Total alerts", String(summary?.total_alerts ?? 0)],
            ["Avg risk score", `${avgRiskPct}%`]
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 text-xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
        {updatedAt ? (
          <p className="mt-4 text-xs text-muted">Updated {updatedAt.toLocaleTimeString()}</p>
        ) : null}
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-brand">Live Threat Snapshot</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Public OT Detection Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Real-time metrics pulled directly from the detection database.</p>
        </div>
        {updatedAt ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted">
            Updated {updatedAt.toLocaleTimeString()}
          </span>
        ) : null}
      </div>

      {loading ? <p className="mt-4 text-sm text-muted">Loading live snapshot...</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Packets analysed</p>
          <p className="mt-2 text-3xl font-semibold text-white">{(summary?.total_records ?? 0).toLocaleString()}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Total alerts</p>
          <p className="mt-2 text-3xl font-semibold text-white">{summary?.total_alerts ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Active threats</p>
          <p className="mt-2 text-3xl font-semibold text-rose-200">{activeThreats}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Avg risk score</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-200">{avgRiskPct}%</p>
        </article>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-muted">
            <tr>
              <th className="px-4 py-3">Threat ID</th>
              <th className="px-4 py-3">Attack Vector</th>
              <th className="px-4 py-3">Target Asset</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {threats.slice(0, 8).map((threat) => (
              <tr key={threat.threat_id} className="border-t border-white/10">
                <td className="px-4 py-3 text-white">{threat.threat_id}</td>
                <td className="px-4 py-3 text-muted">{threat.attack_vector}</td>
                <td className="px-4 py-3 text-muted">{threat.target_asset}</td>
                <td className="px-4 py-3 text-rose-200">{threat.risk}</td>
                <td className="px-4 py-3 text-muted">{new Date(threat.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {!loading && !threats.length ? (
              <tr className="border-t border-white/10">
                <td className="px-4 py-3 text-muted" colSpan={5}>
                  No active threats right now.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
