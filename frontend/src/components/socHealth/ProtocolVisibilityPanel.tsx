import { memo } from "react";
import { Cable, Layers } from "lucide-react";

import type { ProtocolVisibilityResponse } from "../../api/trafficApi";

const PROTOCOL_STYLES: Record<string, { bg: string; fill: string; text: string }> = {
  "Modbus TCP": { bg: "bg-cyan-500/5", fill: "bg-cyan-400", text: "text-cyan-300" },
  DNP3: { bg: "bg-indigo-500/5", fill: "bg-indigo-400", text: "text-indigo-300" },
  IEC104: { bg: "bg-emerald-500/5", fill: "bg-emerald-400", text: "text-emerald-300" },
  Other: { bg: "bg-slate-500/5", fill: "bg-slate-400", text: "text-slate-300" }
};

type Props = {
  data: ProtocolVisibilityResponse | null;
  loading: boolean;
  error: string;
};

export const ProtocolVisibilityPanel = memo(function ProtocolVisibilityPanel({ data, loading, error }: Props) {
  const total = data?.total_packets ?? 0;

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-brand">Protocol visibility</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Active OT protocols (24h)</h3>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted">
          <Cable size={14} />
          {loading ? "Syncing" : `${total.toLocaleString()} packets`}
        </div>
      </header>

      {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
      {loading ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-[104px] rounded-2xl border border-white/5 bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : null}

      {!loading && data ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {data.protocols.map((row) => {
            const percent = total > 0 ? Math.round((row.packets / total) * 100) : 0;
            const style = PROTOCOL_STYLES[row.protocol] ?? PROTOCOL_STYLES.Other;
            return (
              <article key={row.protocol} className={`group relative overflow-hidden rounded-2xl border border-white/5 p-4 transition-colors duration-300 hover:bg-white/[0.04] ${style.bg}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs uppercase tracking-[0.16em] ${style.text}`}>{row.protocol}</span>
                  <span className="text-xs font-medium text-white">{percent}%</span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-light text-white">{row.packets.toLocaleString()}</span>
                  <span className="text-xs text-muted">pkts</span>
                </div>
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${style.fill}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {!loading && !data ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
          <div className="flex items-center gap-2">
            <Layers size={16} />
            No protocol telemetry yet. Start ingesting OT traffic to populate this panel.
          </div>
        </div>
      ) : null}
    </section>
  );
});
