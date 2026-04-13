import { useEffect, useState } from "react";

import { fetchActiveThreats, type ActiveThreat } from "../api/phase2Api";

export function ActiveThreatsPage() {
  const [threats, setThreats] = useState<ActiveThreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const rows = await fetchActiveThreats();
        if (!active) return;
        setThreats(rows);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load active threats.");
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

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.16em] text-brand">Threats Page</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">Active Threats</h1>
      <p className="mt-1 text-sm text-muted">Threats currently requiring immediate analyst action.</p>

      {loading ? <p className="mt-4 text-sm text-muted">Loading active threats...</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <article className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
        <p className="text-xs text-rose-200">Current Active Threats</p>
        <p className="mt-2 text-3xl font-semibold text-white">{threats.length}</p>
      </article>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-muted">
            <tr>
              <th className="px-4 py-3">Threat ID</th>
              <th className="px-4 py-3">Attack Vector</th>
              <th className="px-4 py-3">Target Asset</th>
              <th className="px-4 py-3">Risk</th>
            </tr>
          </thead>
          <tbody>
            {threats.map((threat) => (
              <tr key={threat.threat_id} className="border-t border-white/10">
                <td className="px-4 py-3 text-white">{threat.threat_id}</td>
                <td className="px-4 py-3 text-muted">{threat.attack_vector}</td>
                <td className="px-4 py-3 text-muted">{threat.target_asset}</td>
                <td className="px-4 py-3 text-rose-200">{threat.risk}</td>
              </tr>
            ))}
            {!loading && !threats.length ? (
              <tr className="border-t border-white/10">
                <td className="px-4 py-3 text-muted" colSpan={4}>No active threats right now.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
