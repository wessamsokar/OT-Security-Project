import { useEffect, useState } from "react";

import { fetchPacketsByHour, type PacketsByHourResponse } from "../api/phase2Api";

export function PacketsAnalysedPage() {
  const [payload, setPayload] = useState<PacketsByHourResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const data = await fetchPacketsByHour();
        if (!active) return;
        setPayload(data);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load packets analytics.");
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

  const rows = payload?.rows ?? [];

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.16em] text-brand">Packet Page</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">Packets Analysed</h1>
      <p className="mt-1 text-sm text-muted">Detailed packet processing volume for the authenticated user workspace.</p>

      {loading ? <p className="mt-4 text-sm text-muted">Loading packets analytics...</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Today Total</p>
          <p className="mt-2 text-3xl font-semibold text-white">{(payload?.today_total ?? 0).toLocaleString()}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Avg / Minute</p>
          <p className="mt-2 text-3xl font-semibold text-white">{payload?.avg_per_minute ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Peak Hour</p>
          <p className="mt-2 text-3xl font-semibold text-white">{payload?.peak_hour ?? "N/A"}</p>
        </article>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-muted">
            <tr>
              <th className="px-4 py-3">Hour</th>
              <th className="px-4 py-3">Packets</th>
              <th className="px-4 py-3">Dominant Protocol</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.hour} className="border-t border-white/10">
                <td className="px-4 py-3 text-white">{row.hour}</td>
                <td className="px-4 py-3 text-muted">{row.packets.toLocaleString()}</td>
                <td className="px-4 py-3 text-muted">{row.dominant_protocol}</td>
              </tr>
            ))}
            {!loading && !rows.length ? (
              <tr className="border-t border-white/10">
                <td className="px-4 py-3 text-muted" colSpan={3}>No traffic records found in the last 24h.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
