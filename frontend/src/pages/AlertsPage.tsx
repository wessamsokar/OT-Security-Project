export function AlertsPage() {
  const alerts = [
    { id: "A-1102", type: "Modbus Injection", severity: "High", target: "PLC-01", time: "11:42:08" },
    { id: "A-1103", type: "Port Scan", severity: "Medium", target: "SCADA-01", time: "11:44:55" },
    { id: "A-1104", type: "Replay Attack", severity: "Low", target: "HMI-02", time: "11:46:10" }
  ];

  const severityClass = (severity: string) => {
    if (severity === "High") return "bg-rose-500/20 text-rose-300";
    if (severity === "Medium") return "bg-amber-500/20 text-amber-300";
    return "bg-emerald-500/20 text-emerald-300";
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.16em] text-brand">Alerts Page</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">Alerts</h1>
      <p className="mt-1 text-sm text-muted">Focused alert management for current operator shift.</p>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-muted">High</p><p className="mt-2 text-3xl font-semibold text-rose-200">6</p></article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-muted">Medium</p><p className="mt-2 text-3xl font-semibold text-amber-200">9</p></article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-muted">Low</p><p className="mt-2 text-3xl font-semibold text-emerald-200">14</p></article>
      </div>

      <div className="mt-5 space-y-3">
        {alerts.map((alert) => (
          <div key={alert.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-white">{alert.id} - {alert.type}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs ${severityClass(alert.severity)}`}>{alert.severity}</span>
            </div>
            <p className="mt-1 text-xs text-muted">Target: {alert.target} | Time: {alert.time}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
