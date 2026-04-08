export function SecurityPosturePage() {
  const metrics = [
    { label: "System Uptime", value: "99.92%" },
    { label: "Blocked IPs Today", value: "14" },
    { label: "Failed Logins", value: "9" },
    { label: "Model Drift", value: "Stable" }
  ];

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.16em] text-brand">SP Page</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">Security Posture</h1>
      <p className="mt-1 text-sm text-muted">Overall resilience indicators and SOC health status.</p>

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
