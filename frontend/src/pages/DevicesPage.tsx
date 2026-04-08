type DeviceRow = {
  id: string;
  name: string;
  zone: string;
  ip: string;
  protocol: string;
  status: "online" | "offline";
  lastSeen: string;
};

const devices: DeviceRow[] = [
  { id: "1", name: "PLC-A", zone: "Plant A", ip: "10.0.1.11", protocol: "Modbus", status: "online", lastSeen: "now" },
  { id: "2", name: "PLC-B", zone: "Plant A", ip: "10.0.1.12", protocol: "Modbus", status: "online", lastSeen: "3s ago" },
  { id: "3", name: "RTU-1", zone: "Substation 1", ip: "10.0.2.20", protocol: "DNP3", status: "online", lastSeen: "8s ago" },
  { id: "4", name: "HMI-2", zone: "Plant B", ip: "10.0.3.15", protocol: "EtherNet/IP", status: "offline", lastSeen: "2m ago" },
  { id: "5", name: "SCADA-MAIN", zone: "Control Room", ip: "10.0.0.8", protocol: "TCP", status: "online", lastSeen: "now" }
];

export function DevicesPage() {
  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.16em] text-brand">Device Page</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Devices Status</h1>
        <p className="mt-1 text-sm text-muted">Inventory of OT devices and their current network availability.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-muted">
            <tr>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">Zone</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Protocol</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id} className="border-t border-white/10">
                <td className="px-4 py-3 text-white">{device.name}</td>
                <td className="px-4 py-3 text-muted">{device.zone}</td>
                <td className="px-4 py-3 text-muted">{device.ip}</td>
                <td className="px-4 py-3 text-muted">{device.protocol}</td>
                <td className="px-4 py-3">
                  <span
                    className={[
                      "inline-flex rounded-full px-2 py-0.5 text-xs",
                      device.status === "online" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                    ].join(" ")}
                  >
                    {device.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{device.lastSeen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
