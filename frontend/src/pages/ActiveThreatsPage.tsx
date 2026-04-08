export function ActiveThreatsPage() {
  const threats = [
    { id: "T-301", vector: "DoS burst", asset: "RTU-03", risk: "Critical" },
    { id: "T-302", vector: "Unauthorized write", asset: "PLC-01", risk: "High" },
    { id: "T-303", vector: "Credential spray", asset: "ENG-WS-01", risk: "High" }
  ];

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.16em] text-brand">Threats Page</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">Active Threats</h1>
      <p className="mt-1 text-sm text-muted">Threats currently requiring immediate analyst action.</p>

      <article className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
        <p className="text-xs text-rose-200">Current Active Threats</p>
        <p className="mt-2 text-3xl font-semibold text-white">4</p>
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
              <tr key={threat.id} className="border-t border-white/10">
                <td className="px-4 py-3 text-white">{threat.id}</td>
                <td className="px-4 py-3 text-muted">{threat.vector}</td>
                <td className="px-4 py-3 text-muted">{threat.asset}</td>
                <td className="px-4 py-3 text-rose-200">{threat.risk}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
