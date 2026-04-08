export function PacketsAnalysedPage() {
  const rows = [
    { hour: "08:00", packets: 18450, protocol: "Modbus" },
    { hour: "09:00", packets: 22104, protocol: "TCP" },
    { hour: "10:00", packets: 19740, protocol: "EtherNet/IP" },
    { hour: "11:00", packets: 24820, protocol: "DNP3" }
  ];

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.16em] text-brand">Packet Page</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">Packets Analysed</h1>
      <p className="mt-1 text-sm text-muted">Detailed packet processing volume for the authenticated user workspace.</p>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Today Total</p>
          <p className="mt-2 text-3xl font-semibold text-white">125,460</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Avg / Minute</p>
          <p className="mt-2 text-3xl font-semibold text-white">214</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted">Peak Hour</p>
          <p className="mt-2 text-3xl font-semibold text-white">11:00</p>
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
                <td className="px-4 py-3 text-muted">{row.protocol}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
