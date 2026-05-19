import { memo } from "react";
import { Activity, Clock } from "lucide-react";

export type SocActivityEvent = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  severity: "info" | "warning" | "critical";
};

const SEVERITY_STYLES: Record<SocActivityEvent["severity"], string> = {
  info: "border-l-sky-500 bg-sky-500/5",
  warning: "border-l-amber-500 bg-amber-500/5",
  critical: "border-l-rose-500 bg-rose-500/5"
};

type Props = {
  events: SocActivityEvent[];
  loading: boolean;
};

export const SocActivityFeed = memo(function SocActivityFeed({ events, loading }: Props) {
  return (
    <section className="flex flex-col h-full max-h-[calc(100vh-8rem)] rounded-3xl border border-white/10 bg-panel/45 shadow-panel overflow-hidden">
      <header className="shrink-0 border-b border-white/5 p-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-brand">SOC activity</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Live operations feed</h3>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted">
          <Activity size={14} />
          {loading ? "Syncing" : `${events.length} events`}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 pt-0 no-scrollbar">
        {loading ? (
          <div className="mt-5 space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="h-20 rounded-xl border border-white/5 bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : null}

        {!loading ? (
          <div className="mt-5 space-y-3">
            {events.length > 0 ? (
              events.map((event) => (
                <article key={event.id} className={`group relative rounded-r-xl border border-l-4 border-y-white/5 border-r-white/5 p-4 transition-colors duration-300 hover:bg-white/[0.04] ${SEVERITY_STYLES[event.severity]}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{event.title}</p>
                      <p className="mt-1 text-xs text-muted">{event.detail}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted">
                    <Clock size={10} className="text-brand/70" />
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-muted">
                No live activity yet. Telemetry and detections will appear here as soon as traffic flows.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
});
