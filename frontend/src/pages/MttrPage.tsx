export function MttrPage() {
  const incidents = [
    { id: "INC-88", opened: "10:03", resolved: "10:19", mttr: "16m" },
    { id: "INC-89", opened: "10:35", resolved: "10:52", mttr: "17m" },
    { id: "INC-90", opened: "11:00", resolved: "11:22", mttr: "22m" }
  ];

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.16em] text-brand">Mttr Page</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">MTTR</h1>
      <p className="mt-1 text-sm text-muted">Mean Time To Respond for incidents in the current monitoring window.</p>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Average MTTR</p>
          <p className="mt-2 text-3xl font-semibold text-white">18m</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Target SLA</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-200">{`<= 20m`}</p>
        </article>
      </div>

      <div className="mt-5 space-y-3">
        {incidents.map((incident) => (
          <div key={incident.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
            <p className="text-white">{incident.id}</p>
            <p className="mt-1 text-muted">Opened: {incident.opened} | Resolved: {incident.resolved} | MTTR: {incident.mttr}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
