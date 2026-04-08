import { useEffect, useMemo, useState } from "react";

import { getAuthSession } from "../lib/authSession";

type AlertItem = {
  id: string;
  severity: "High" | "Medium" | "Low";
  attackType: string;
  sourceIp: string;
  targetDevice: string;
  time: string;
};

type LogItem = {
  id: string;
  timestamp: string;
  sourceIp: string;
  destinationIp: string;
  protocol: string;
  classification: "Normal" | "Suspicious" | "Attack";
};

type TrafficPoint = {
  hour: string;
  value: number;
  kind: "normal" | "suspicious" | "attack";
};

const alertPool: Omit<AlertItem, "id" | "time">[] = [
  { severity: "High", attackType: "Modbus Injection", sourceIp: "192.168.1.83", targetDevice: "PLC-01" },
  { severity: "Medium", attackType: "Port Scan", sourceIp: "192.168.1.56", targetDevice: "SCADA-01" },
  { severity: "Low", attackType: "Replay Attack", sourceIp: "192.168.1.102", targetDevice: "HMI-02" },
  { severity: "High", attackType: "DoS", sourceIp: "192.168.1.74", targetDevice: "RTU-03" },
  { severity: "Medium", attackType: "Brute Force", sourceIp: "192.168.1.120", targetDevice: "ENG-WS-01" }
];

const initialLogs: LogItem[] = [
  {
    id: "l1",
    timestamp: "2026-04-08 10:11:42",
    sourceIp: "192.168.1.31",
    destinationIp: "192.168.1.10",
    protocol: "Modbus",
    classification: "Normal"
  },
  {
    id: "l2",
    timestamp: "2026-04-08 10:12:15",
    sourceIp: "192.168.1.77",
    destinationIp: "192.168.1.20",
    protocol: "TCP",
    classification: "Suspicious"
  },
  {
    id: "l3",
    timestamp: "2026-04-08 10:12:59",
    sourceIp: "192.168.1.83",
    destinationIp: "192.168.1.10",
    protocol: "Modbus",
    classification: "Attack"
  },
  {
    id: "l4",
    timestamp: "2026-04-08 10:13:20",
    sourceIp: "192.168.1.53",
    destinationIp: "192.168.1.21",
    protocol: "EtherNet/IP",
    classification: "Normal"
  },
  {
    id: "l5",
    timestamp: "2026-04-08 10:14:04",
    sourceIp: "192.168.1.74",
    destinationIp: "192.168.1.30",
    protocol: "UDP",
    classification: "Attack"
  }
];

function severityClasses(severity: AlertItem["severity"]) {
  if (severity === "High") return "bg-rose-500/20 text-rose-300";
  if (severity === "Medium") return "bg-amber-500/20 text-amber-300";
  return "bg-emerald-500/20 text-emerald-300";
}

function trafficClasses(kind: TrafficPoint["kind"]) {
  if (kind === "attack") return "bg-rose-500";
  if (kind === "suspicious") return "bg-amber-500";
  return "bg-sky-500";
}

function logClasses(classification: LogItem["classification"]) {
  if (classification === "Attack") return "text-rose-200";
  if (classification === "Suspicious") return "text-amber-200";
  return "text-muted";
}

export function DashboardPage() {
  const [packetCount, setPacketCount] = useState(125460);
  const [alerts, setAlerts] = useState<AlertItem[]>(() =>
    alertPool.map((item, index) => ({
      ...item,
      id: `a-${index + 1}`,
      time: new Date(Date.now() - index * 60000).toLocaleTimeString()
    }))
  );
  const [logs, setLogs] = useState<LogItem[]>(initialLogs);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPacketCount((prev) => prev + Math.floor(Math.random() * 45) + 18);

      if (Math.random() > 0.55) {
        const template = alertPool[Math.floor(Math.random() * alertPool.length)];
        const nextAlert: AlertItem = {
          ...template,
          id: `a-${Date.now()}`,
          time: new Date().toLocaleTimeString()
        };
        setAlerts((prev) => [nextAlert, ...prev].slice(0, 6));

        const nextLog: LogItem = {
          id: `l-${Date.now()}`,
          timestamp: new Date().toLocaleString(),
          sourceIp: template.sourceIp,
          destinationIp: `192.168.1.${Math.floor(Math.random() * 50) + 10}`,
          protocol: ["Modbus", "TCP", "UDP", "DNP3", "EtherNet/IP"][Math.floor(Math.random() * 5)],
          classification: template.severity === "High" ? "Attack" : template.severity === "Medium" ? "Suspicious" : "Normal"
        };
        setLogs((prev) => [nextLog, ...prev].slice(0, 8));
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const session = getAuthSession();
  const welcomeName = session?.user.fullName ?? "Security Analyst";
  const firstName = welcomeName.split(" ")[0] ?? "Analyst";

  const totalAlertsToday = useMemo(() => 26 + alerts.length, [alerts]);
  const activeThreats = useMemo(() => alerts.filter((item) => item.severity === "High").length + 1, [alerts]);
  const mlConfidence = useMemo(() => 94 + ((packetCount % 30) / 10), [packetCount]);

  const trafficSeries: TrafficPoint[] = useMemo(
    () => [
      { hour: "01", value: 140, kind: "normal" },
      { hour: "02", value: 128, kind: "normal" },
      { hour: "03", value: 166, kind: "suspicious" },
      { hour: "04", value: 175, kind: "normal" },
      { hour: "05", value: 190, kind: "attack" },
      { hour: "06", value: 212, kind: "normal" },
      { hour: "07", value: 238, kind: "suspicious" },
      { hour: "08", value: 262, kind: "normal" },
      { hour: "09", value: 248, kind: "normal" },
      { hour: "10", value: 221, kind: "attack" },
      { hour: "11", value: 239, kind: "suspicious" },
      { hour: "12", value: 272 + (packetCount % 20), kind: "normal" }
    ],
    [packetCount]
  );

  return (
    <section className="space-y-5 rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/10 to-white/5 p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-brand">User Dashboard</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Welcome back, {firstName}</h1>
        <p className="mt-1 text-sm text-muted">Assigned SOC view with real-time alerts, traffic, tasks, and security posture.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Packets Analysed</p>
          <p className="mt-2 text-3xl font-semibold text-white">{packetCount.toLocaleString()}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Total Alerts Today</p>
          <p className="mt-2 text-3xl font-semibold text-white">{totalAlertsToday}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Active Threats</p>
          <p className="mt-2 text-3xl font-semibold text-rose-200">{activeThreats}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-muted">MTTR</p>
          <p className="mt-2 text-3xl font-semibold text-white">18m</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-muted">ML Confidence</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-200">{mlConfidence.toFixed(1)}%</p>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-white">Network Traffic (Last 12 Hours)</h2>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" /> Normal</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Suspicious</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Attack</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-12 items-end gap-2">
            {trafficSeries.map((point) => (
              <div key={point.hour} className="flex flex-col items-center gap-2">
                <div className="flex h-36 w-full max-w-8 items-end rounded-sm bg-background/40 p-[2px]">
                  <div
                    className={`w-full rounded-sm ${trafficClasses(point.kind)}`}
                    style={{ height: `${Math.max(8, Math.min(100, Math.round((point.value / 300) * 100)))}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted">{point.hour}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-medium text-white">My Tasks</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-xl border border-white/10 bg-background/40 p-3">
              <p className="text-white">Investigate Modbus Injection on PLC-01</p>
              <p className="mt-1 text-xs text-muted">SLA: 12m remaining</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-background/40 p-3">
              <p className="text-white">Review replay anomaly at HMI-02</p>
              <p className="mt-1 text-xs text-muted">SLA: 26m remaining</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-background/40 p-3">
              <p className="text-white">Confirm whitelist for inventory scanner</p>
              <p className="mt-1 text-xs text-muted">SLA: 41m remaining</p>
            </div>
          </div>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-medium text-white">Live Alerts</h2>
          <div className="mt-3 space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-xl border border-white/10 bg-background/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-white">{alert.attackType}</p>
                    <p className="mt-1 text-xs text-muted">{alert.sourceIp} to {alert.targetDevice}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${severityClasses(alert.severity)}`}>{alert.severity}</span>
                </div>
                <p className="mt-2 text-xs text-muted">{alert.time}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-medium text-white">Recent Logs</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="pb-2 pr-3">Timestamp</th>
                  <th className="pb-2 pr-3">Source</th>
                  <th className="pb-2 pr-3">Protocol</th>
                  <th className="pb-2">Class</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-white/10">
                    <td className="py-2 pr-3 text-muted">{log.timestamp}</td>
                    <td className="py-2 pr-3 text-muted">{log.sourceIp}</td>
                    <td className="py-2 pr-3 text-muted">{log.protocol}</td>
                    <td className={`py-2 font-medium ${logClasses(log.classification)}`}>{log.classification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-medium text-white">Top Risky Assets</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-background/40 px-3 py-2">
              <span className="text-white">PLC-01 (Modbus)</span>
              <span className="text-rose-200">11 alerts</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-background/40 px-3 py-2">
              <span className="text-white">SCADA-01 (TCP)</span>
              <span className="text-amber-200">7 alerts</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-background/40 px-3 py-2">
              <span className="text-white">RTU-03 (DNP3)</span>
              <span className="text-amber-200">5 alerts</span>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-medium text-white">Security Posture</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-white/10 bg-background/40 p-3">
              <p className="text-xs text-muted">System Uptime</p>
              <p className="mt-1 text-white">99.92%</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-background/40 p-3">
              <p className="text-xs text-muted">Blocked IPs</p>
              <p className="mt-1 text-white">14</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-background/40 p-3">
              <p className="text-xs text-muted">Failed Logins</p>
              <p className="mt-1 text-white">9</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-background/40 p-3">
              <p className="text-xs text-muted">Model Drift</p>
              <p className="mt-1 text-emerald-200">Stable</p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
