export function MlConfidencePage() {
  const features = [
    { name: "Packet Size", weight: 0.16 },
    { name: "Flow Duration", weight: 0.13 },
    { name: "Protocol Type", weight: 0.12 },
    { name: "Port Number", weight: 0.1 }
  ];

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.16em] text-brand">ML Page</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">ML Confidence</h1>
      <p className="mt-1 text-sm text-muted">Model confidence and explainability snapshot for operator decisions.</p>

      <article className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <p className="text-xs text-emerald-200">Current Confidence</p>
        <p className="mt-2 text-3xl font-semibold text-white">96.1%</p>
      </article>

      <div className="mt-5 space-y-3">
        {features.map((feature) => (
          <div key={feature.name}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-white">{feature.name}</span>
              <span className="text-muted">{Math.round(feature.weight * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-brand" style={{ width: `${feature.weight * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
