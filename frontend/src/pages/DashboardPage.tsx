import { useEffect, useMemo, useRef, useState } from "react";
import { Info, X } from "lucide-react";
import { Link } from "react-router-dom";

import { fetchAlerts, fetchDashboardSummary, type AlertResponse, type DashboardSummary } from "../api/alertsApi";
import { fetchDevices, type DeviceResponse } from "../api/devicesApi";
import {
  fetchActiveThreats,
  fetchPacketsByHour,
  fetchSocHealth,
  fetchMttr,
  type ActiveThreat,
  type PacketsByHourResponse,
  type SocHealthPayload,
  type MttrSummary
} from "../api/phase2Api";
import { fetchUsers } from "../api/usersApi";
import { connectAlertsStream } from "../api/streamApi";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";

function severityClasses(severity: "critical" | "high" | "medium" | "low") {
  if (severity === "critical") return "border-rose-600/50 bg-rose-500/20 text-rose-200 animate-pulse ring-1 ring-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)]";
  if (severity === "high") return "border-orange-500/30 bg-orange-500/15 text-orange-300";
  if (severity === "medium") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  return "border-slate-500/30 bg-slate-500/15 text-slate-300";
}

function logClasses(severity: AlertResponse["severity"]) {
  if (severity === "critical") return "text-rose-200 font-bold";
  if (severity === "high") return "text-orange-300 font-semibold";
  if (severity === "medium") return "text-amber-200";
  return "text-slate-300";
}

function StatCard({
  label,
  value,
  hint,
  accent,
  tooltip
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
  tooltip?: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-1.5">
        <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
        {tooltip ? (
          <span title={tooltip} className="cursor-help text-muted transition hover:text-white">
            <Info size={12} />
          </span>
        ) : null}
      </div>
      <p className={`mt-2 text-3xl font-semibold ${accent ?? "text-white"}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </article>
  );
}

function QuickAction({ to, label, description }: { to: string; label: string; description: string }) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
    >
      <span className="block text-sm font-medium text-white">{label}</span>
      <span className="mt-1 block text-xs text-muted">{description}</span>
    </Link>
  );
}

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<AlertResponse[]>([]);
  const [activeThreats, setActiveThreats] = useState<ActiveThreat[]>([]);
  const [packets, setPackets] = useState<PacketsByHourResponse | null>(null);
  const [socHealth, setSocHealth] = useState<SocHealthPayload | null>(null);
  const [mttr, setMttr] = useState<MttrSummary | null>(null);
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [adminUsers, setAdminUsers] = useState(0);
  const [pendingOnboarding, setPendingOnboarding] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [threatsLoading, setThreatsLoading] = useState(false);
  const [packetsLoading, setPacketsLoading] = useState(false);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [socLoading, setSocLoading] = useState(false);
  const [mttrLoading, setMttrLoading] = useState(false);

  const [summaryError, setSummaryError] = useState("");
  const [alertsError, setAlertsError] = useState("");
  const [threatsError, setThreatsError] = useState("");
  const [packetsError, setPacketsError] = useState("");
  const [devicesError, setDevicesError] = useState("");
  const [adminError, setAdminError] = useState("");
  const [socError, setSocError] = useState("");
  const [mttrError, setMttrError] = useState("");
  const alertsErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user, hasPermission } = useAuth();
  const { activeTenantId, canSelectTenant, assignedCustomers, isLoadingAssignments } = useTenant();
  const role = user?.role ?? "customer";
  const isAdmin = role === "admin";
  const tenantId = (role === "analyst" || role === "viewer") ? activeTenantId : undefined;
  const roleLabel = role.replace(/^\w/, (char) => char.toUpperCase());
  const welcomeName = user?.fullName ?? "Operator";
  const rawFirstName = user?.fullName?.split(" ")[0] || user?.email?.split("@")[0] || "User";
  const firstName = rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1);

  const canViewDashboard = hasPermission("view_dashboard");
  const canViewAlerts = hasPermission("view_alerts");
  const canViewDevices = hasPermission("view_devices");
  const canViewUsers = hasPermission("view_users");
  const canViewSocHealth = hasPermission("view_soc_health");
  const canViewTraffic = hasPermission("view_traffic");

  const needsSummary = canViewDashboard;
  const needsAlertsList = canViewAlerts && (role === "admin" || role === "analyst");
  const needsThreats = canViewAlerts && role === "analyst";
  const needsPackets = canViewTraffic && (role === "analyst" || role === "viewer" || role === "customer");
  const needsDevices = canViewDevices && (role === "admin" || role === "viewer" || role === "customer");
  const needsUsers = canViewUsers && role === "admin";
  const needsSocHealth = canViewSocHealth && role === "admin";
  const needsMttr = (role === "admin" || role === "analyst");

  useEffect(() => {
    // Only warn about empty assignments for non-admin roles
    if (isAdmin || !canSelectTenant || isLoadingAssignments) return;
    if (assignedCustomers.length === 0) {
      const message = "No customer tenants assigned. Contact an administrator.";
      setSummaryLoading(false);
      setAlertsLoading(false);
      setThreatsLoading(false);
      setPacketsLoading(false);
      setDevicesLoading(false);
      setSocLoading(false);
      setSummaryError(message);
      setAlertsError(message);
      setThreatsError(message);
      setPacketsError(message);
      setDevicesError(message);
      setSocError(message);
      setMttrError(message);
    }
  }, [isAdmin, canSelectTenant, isLoadingAssignments, assignedCustomers.length]);

    useEffect(() => {
      let active = true;
      // Wait for tenant context to fully resolve before fetching anything
      if (!isAdmin && canSelectTenant && (isLoadingAssignments || !tenantId || assignedCustomers.length === 0)) return;

      const loadAll = async () => {
        if (needsSummary) setSummaryLoading(true);
        if (needsAlertsList) setAlertsLoading(true);
        if (needsThreats) setThreatsLoading(true);
        if (needsPackets) setPacketsLoading(true);
        if (needsDevices) setDevicesLoading(true);
        if (needsUsers) setAdminLoading(true);
        if (needsSocHealth) setSocLoading(true);
        if (needsMttr) setMttrLoading(true);

        const promises = [];

        if (needsSummary) {
          promises.push(
            fetchDashboardSummary(tenantId)
              .then((data) => { if (active) { setSummary(data); setSummaryError(""); setSummaryLoading(false); } })
              .catch((err) => { if (active) { setSummaryError(err.message); setSummaryLoading(false); } })
          );
        }

        if (needsThreats) {
          promises.push(
            fetchActiveThreats(tenantId)
              .then((data) => { if (active) { setActiveThreats(data); setThreatsError(""); setThreatsLoading(false); } })
              .catch((err) => { if (active) { setThreatsError(err.message); setThreatsLoading(false); } })
          );
        }

        if (needsPackets) {
          promises.push(
            fetchPacketsByHour(tenantId)
              .then((data) => { if (active) { setPackets(data); setPacketsError(""); setPacketsLoading(false); } })
              .catch((err) => { if (active) { setPacketsError(err.message); setPacketsLoading(false); } })
          );
        }

        if (needsDevices) {
          promises.push(
            fetchDevices(tenantId)
              .then((data) => { if (active) { setDevices(data); setDevicesError(""); setDevicesLoading(false); } })
              .catch((err) => { if (active) { setDevicesError(err.message); setDevicesLoading(false); } })
          );
        }

        if (needsUsers) {
          promises.push(
            fetchUsers()
              .then((data) => {
                if (active) {
                  setAdminUsers(data.length);
                  setPendingOnboarding(data.filter((row: any) => row.onboarding_status === "pending").length);
                  setAdminError("");
                  setAdminLoading(false);
                }
              })
              .catch((err) => { if (active) { setAdminError(err.message); setAdminLoading(false); } })
          );
        }

        if (needsSocHealth) {
          promises.push(
            fetchSocHealth(tenantId)
              .then((data) => { if (active) { setSocHealth(data); setSocError(""); setSocLoading(false); } })
              .catch((err) => { if (active) { setSocError(err.message); setSocLoading(false); } })
          );
        }

        if (needsMttr) {
          promises.push(
            fetchMttr()
              .then((data) => { if (active) { setMttr(data); setMttrError(""); setMttrLoading(false); } })
              .catch((err) => { if (active) { setMttrError(err.message); setMttrLoading(false); } })
          );
        }

        try {
          await Promise.all(promises);
        } catch (err) {
          console.error("Dashboard fetch error:", err);
        }
      };

      void loadAll();

      return () => { active = false; };
    }, [
      tenantId, isAdmin, canSelectTenant, isLoadingAssignments, assignedCustomers.length,
      needsSummary, needsAlertsList, needsThreats, needsPackets, needsDevices, needsUsers, needsSocHealth, needsMttr
    ]);

    useEffect(() => {
      let active = true;
      if (!needsAlertsList) return;
      if (!isAdmin && canSelectTenant && (isLoadingAssignments || !tenantId || assignedCustomers.length === 0)) return;

      const stream = connectAlertsStream(
        (snapshot) => {
          if (!active) return;
          if (alertsErrorTimerRef.current) {
            clearTimeout(alertsErrorTimerRef.current);
            alertsErrorTimerRef.current = null;
          }
          setAlerts(snapshot.alerts);
          if (needsSummary) {
            setSummary(snapshot.dashboard);
          }
          setAlertsError("");
          setAlertsLoading(false);
        },
        () => {
          if (!active) return;
          if (alertsErrorTimerRef.current) return;
          alertsErrorTimerRef.current = setTimeout(() => {
            setAlertsError("Live stream disconnected. Showing latest available alerts.");
            alertsErrorTimerRef.current = null;
          }, 8000); // 8s grace period absorbs normal server-side reconnects
        },
        tenantId,
        { lazy: true, visibilityAware: true }
      );

      return () => {
        active = false;
        if (alertsErrorTimerRef.current) {
          clearTimeout(alertsErrorTimerRef.current);
          alertsErrorTimerRef.current = null;
        }
        stream?.close();
      };
    }, [needsAlertsList, needsSummary, tenantId, canSelectTenant, isLoadingAssignments, assignedCustomers.length, isAdmin]);

    /**
     * Metric separation:
     * - flowCount24h       : COUNT of TrafficRecord rows in last 24h (operational flows)
     * - packetCount24h     : SUM of TrafficRecord.packet_count in last 24h (network packets)
     * - totalRecordsAllTime: COUNT of ALL TrafficRecord rows ever (historical)
     * - totalAlertsAllTime : COUNT of ALL Alert rows (all time)
     *
     * Do NOT mix these — they represent different things in the network stack.
     */
    const flowCount24h = summary?.flows_last_24h ?? 0;
    const packetCount24h = summary?.total_packet_count_24h ?? 0;
    const totalRecordsAllTime = summary?.total_records ?? 0;
    const totalAlertsAllTime = summary?.total_alerts ?? 0;
    const meanRiskPct = ((summary?.avg_risk_score ?? 0) * 100).toFixed(1);
    const highAlerts = alerts.filter((item) => item.severity === "critical" || item.severity === "high").length;
    const deviceActiveCount = devices.filter((d) => d.is_active && d.monitoring_status === "active").length;
    const deviceOnlineCount = devices.filter((d) => d.operational_state === "online").length;
    const deviceOfflineCount = devices.filter((d) => d.operational_state === "offline").length;
    const deviceCoverage = devices.length ? Math.round((deviceActiveCount / devices.length) * 100) : 0;
    const protocolMix = useMemo(() => {
      if (!packets?.rows) return [] as Array<{ label: string; value: number }>;
      const tally = new Map<string, number>();
      packets.rows.forEach((row) => {
        if (!row.dominant_protocol) return;
        tally.set(row.dominant_protocol, (tally.get(row.dominant_protocol) ?? 0) + row.packets);
      });
      return Array.from(tally.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, value]) => ({ label, value }));
    }, [packets]);

    const attackClassSeries = useMemo(
      () =>
        Object.entries(summary?.class_distribution ?? {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([label, value]) => ({ label, value })),
      [summary]
    );

    const roleTitleMap: Record<string, string> = {
      admin: "Platform Admin",
      analyst: "SOC Analyst",
      viewer: "Operational Viewer",
      customer: "Customer Operations"
    };

    return (
      <section className="space-y-5 rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
        {canSelectTenant && !isAdmin && isLoadingAssignments ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.16em] text-muted">
            Loading customer scope…
          </div>
        ) : null}
        {canSelectTenant && !isAdmin && !isLoadingAssignments && assignedCustomers.length === 0 ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            No customer tenants assigned. Contact an administrator to access data.
          </div>
        ) : null}
        {showWelcome ? (
          <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/10 to-white/5 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-brand">
                  {roleTitleMap[role] ?? `${roleLabel} Dashboard`}
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-white">Welcome back, {firstName}</h1>
                <p className="mt-1 text-sm text-muted">
                  {role === "admin"
                    ? "Platform oversight, onboarding approvals, and security posture at a glance."
                    : role === "analyst"
                    ? "SOC operations workspace: active threats, detections, and telemetry focus."
                    : role === "viewer"
                    ? "Read-only operational visibility with low-noise monitoring context."
                    : "Operational view of your OT environment, coverage, and telemetry health."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowWelcome(false)}
                className="rounded-full border border-white/10 bg-white/5 p-1.5 text-muted transition hover:text-white"
                aria-label="Hide welcome panel"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : null}

        {summaryLoading ? <p className="text-sm text-muted">Loading dashboard data...</p> : null}
        {summaryError ? <p className="text-sm text-danger">{summaryError}</p> : null}

        {role === "admin" ? (
          <>
            {adminLoading ? <p className="text-sm text-muted">Loading admin overview...</p> : null}
            {adminError ? <p className="text-sm text-danger">{adminError}</p> : null}
            {socLoading ? <p className="text-sm text-muted">Loading system health...</p> : null}
            {socError ? <p className="text-sm text-danger">{socError}</p> : null}
            {mttrLoading ? <p className="text-sm text-muted">Loading MTTR...</p> : null}
            {mttrError ? <p className="text-sm text-danger">{mttrError}</p> : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
              <StatCard label="Total users" value={adminUsers.toLocaleString()} />
              <StatCard label="Active devices" value={devices.length.toLocaleString()} />
              <StatCard label="Onboarding requests" value={pendingOnboarding} accent="text-amber-200" />
              <StatCard label="SOC Health" value={socHealth?.traffic_flows_in_window?.toLocaleString() ?? "—"} hint="Flow records (24h window)" />
              <StatCard label="Open incidents" value={summary?.incidents_open ?? 0} />
              <StatCard label="Alerts (all time)" value={totalAlertsAllTime} />
              <StatCard label="Avg risk" value={`${meanRiskPct}%`} />
              <StatCard label="Avg MTTR" value={mttr?.average_mttr_minutes ? `${mttr.average_mttr_minutes}m` : "—"} />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1.4fr]">
              <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-lg font-medium text-white">Quick actions</h2>
                <p className="mt-1 text-sm text-muted">Administrative control surface.</p>
                <div className="mt-4 grid gap-2">
                  {canViewUsers ? (
                    <QuickAction to="/dashboard/admin/users" label="Manage users" description="Access control and onboarding." />
                  ) : null}
                  {hasPermission("view_roles") ? (
                    <QuickAction to="/dashboard/admin/roles" label="Manage roles" description="RBAC roles and permissions." />
                  ) : null}
                  {canViewSocHealth ? (
                    <QuickAction to="/dashboard/soc-health" label="System health" description="ML pipeline and monitoring." />
                  ) : null}
                  <QuickAction to="/dashboard/settings" label="Platform settings" description="Operational configuration." />
                </div>
              </article>

              <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-lg font-medium text-white">System alerts</h2>
                {alertsLoading ? <p className="mt-2 text-sm text-muted">Loading alerts...</p> : null}
                {alertsError ? <p className="mt-2 text-sm text-danger">{alertsError}</p> : null}
                <div className="mt-3 space-y-2">
                  {alerts.slice(0, 6).map((alert) => (
                    <div key={alert.id} className="rounded-xl border border-white/10 bg-background/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-white">{alert.summary}</p>
                          <p className="mt-1 text-xs text-muted">Traffic Record: {alert.traffic_record_id}</p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${severityClasses(
                            alert.severity
                          )}`}
                        >
                          {alert.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted">{new Date(alert.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                  {!alerts.length ? <p className="text-sm text-muted">No alerts recorded yet.</p> : null}
                </div>
              </article>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-lg font-medium text-white">Onboarding status</h2>
                <p className="mt-1 text-xs text-muted">Pending approvals and system scope changes.</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-background/40 px-3 py-2">
                    <span className="text-white">Pending requests</span>
                    <span className="text-muted">{pendingOnboarding}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-background/40 px-3 py-2">
                    <span className="text-white">Devices registered</span>
                    <span className="text-muted">{devices.length}</span>
                  </div>
                </div>
              </article>

              <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-lg font-medium text-white">ML status distribution</h2>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl border border-white/10 bg-background/40 p-3">
                    <p className="text-xs text-muted">Incidents open</p>
                    <p className="mt-1 text-white">{summary?.incidents_open ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-background/40 p-3">
                    <p className="text-xs text-muted">Avg risk_score</p>
                    <p className="mt-1 text-white">{meanRiskPct}%</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-background/40 p-3">
                    <p className="text-xs text-muted">Alerts (all time)</p>
                    <p className="mt-1 text-white">{totalAlertsAllTime}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-background/40 p-3">
                    <p className="text-xs text-muted">Top ml_status</p>
                    <p className="mt-1 text-white">
                      {Object.entries(summary?.ml_status_distribution ?? {})
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 2)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </>
        ) : role === "analyst" ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Active alerts" value={alerts.length} accent="text-rose-200" />
              <StatCard label="High-risk detections" value={highAlerts} accent="text-amber-200" />
              <StatCard label="Open incidents" value={summary?.incidents_open ?? 0} />
              <StatCard label="Flow Records (24h)" value={flowCount24h.toLocaleString()} tooltip="Number of telemetry flow records ingested." />
              <StatCard label="Network Packets (24h)" value={(packets?.packet_count_total ?? packets?.today_total ?? 0).toLocaleString()} tooltip="Total packets reported across all flow records." />
              <StatCard label="Avg MTTR" value={mttr?.average_mttr_minutes ? `${mttr.average_mttr_minutes}m` : "—"} />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.4fr]">
              <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-lg font-medium text-white">Quick actions</h2>
                <p className="mt-1 text-sm text-muted">SOC workflows and investigation tools.</p>
                <div className="mt-4 grid gap-2">
                  <QuickAction to="/dashboard/alerts" label="Investigate alerts" description="Review and triage." />
                  <QuickAction to="/dashboard/alerts?view=threats" label="Active threats" description="Critical/high activity." />
                  <QuickAction to="/dashboard/packets-analysed" label="Review telemetry" description="Traffic trends." />
                </div>
              </article>

              <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-lg font-medium text-white">Active threat queue</h2>
                {threatsLoading ? <p className="mt-2 text-sm text-muted">Loading threats...</p> : null}
                {threatsError ? <p className="mt-2 text-sm text-danger">{threatsError}</p> : null}
                <div className="mt-3 space-y-2 text-sm">
                  {activeThreats.slice(0, 6).map((threat) => (
                    <div key={threat.threat_id} className="flex items-center justify-between rounded-xl border border-white/10 bg-background/40 px-3 py-2">
                      <span className="text-white">{threat.attack_vector}</span>
                      <span className="text-rose-200">{threat.risk}</span>
                    </div>
                  ))}
                  {!activeThreats.length ? <p className="text-sm text-muted">No active threats right now.</p> : null}
                </div>
              </article>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-lg font-medium text-white">Recent alerts</h2>
                {alertsLoading ? <p className="mt-2 text-sm text-muted">Loading alerts...</p> : null}
                {alertsError ? <p className="mt-2 text-sm text-danger">{alertsError}</p> : null}
                <div className="mt-3 space-y-2">
                  {alerts.slice(0, 6).map((alert) => (
                    <div key={alert.id} className="rounded-xl border border-white/10 bg-background/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-white">{alert.summary}</p>
                          <p className="mt-1 text-xs text-muted">Traffic Record: {alert.traffic_record_id}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${severityClasses(alert.severity)}`}>{alert.severity.toUpperCase()}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted">{new Date(alert.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                  {!alerts.length ? <p className="text-sm text-muted">No live alerts yet.</p> : null}
                </div>
              </article>

              <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-lg font-medium text-white">Telemetry & anomalies</h2>
                {packetsLoading ? <p className="mt-2 text-sm text-muted">Loading telemetry...</p> : null}
                {packetsError ? <p className="mt-2 text-sm text-danger">{packetsError}</p> : null}
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl border border-white/10 bg-background/40 p-3">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-muted">Network Packets (24h)</p>
                      <span title="Total packets reported across all flow records." className="cursor-help text-muted transition hover:text-white">
                        <Info size={12} />
                      </span>
                    </div>
                    <p className="mt-1 text-white">{(packets?.packet_count_total ?? packets?.today_total ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-background/40 p-3">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-muted">Flow Records (24h)</p>
                      <span title="Number of telemetry flow records ingested." className="cursor-help text-muted transition hover:text-white">
                        <Info size={12} />
                      </span>
                    </div>
                    <p className="mt-1 text-white">{(packets?.flow_count_total ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-background/40 p-3">
                    <p className="text-xs text-muted">Avg pkts/min (15m)</p>
                    <p className="mt-1 text-white">{packets?.avg_per_minute ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-background/40 p-3">
                    <p className="text-xs text-muted">Top attack classes</p>
                    <p className="mt-1 text-white">
                      {attackClassSeries.map((entry) => entry.label).slice(0, 2).join(" · ") || "—"}
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </>
        ) : role === "viewer" ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Monitored devices" value={devices.length} />
              <StatCard label="Coverage" value={`${deviceCoverage}%`} hint={`${deviceActiveCount}/${devices.length} active`} />
              <StatCard label="Alerts (all time)" value={totalAlertsAllTime} accent="text-amber-200" />
              <StatCard label="Flow Records (24h)" value={flowCount24h.toLocaleString()} tooltip="Number of telemetry flow records ingested." />
              <StatCard label="Network Packets (24h)" value={(packets?.packet_count_total ?? packets?.today_total ?? 0).toLocaleString()} tooltip="Total packets reported across all flow records." />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-lg font-medium text-white">Device monitoring summary</h2>
                {devicesLoading ? <p className="mt-2 text-sm text-muted">Loading devices...</p> : null}
                {devicesError ? <p className="mt-2 text-sm text-danger">{devicesError}</p> : null}
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-background/40 px-3 py-2">
                    <span className="text-white">Online Devices</span>
                    <span className="text-emerald-400">{deviceOnlineCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-background/40 px-3 py-2">
                    <span className="text-white">Offline Devices</span>
                    <span className="text-rose-400">{deviceOfflineCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-background/40 px-3 py-2">
                    <span className="text-white">Inventory total</span>
                    <span className="text-muted">{devices.length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-background/40 px-3 py-2">
                    <span className="text-white">Average risk</span>
                    <span className="text-muted">{meanRiskPct}%</span>
                  </div>
                </div>
              </article>

              <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-lg font-medium text-white">Protocol distribution</h2>
                {packetsLoading ? <p className="mt-2 text-sm text-muted">Loading telemetry...</p> : null}
                {packetsError ? <p className="mt-2 text-sm text-danger">{packetsError}</p> : null}
                <div className="mt-3 space-y-2 text-sm">
                  {protocolMix.map((row) => (
                    <div key={row.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-background/40 px-3 py-2">
                      <span className="text-white">{row.label}</span>
                      <span className="text-muted">{row.value.toLocaleString()}</span>
                    </div>
                  ))}
                  {!protocolMix.length ? <p className="text-sm text-muted">No protocol data yet.</p> : null}
                </div>
              </article>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Registered assets" value={devices.length} />
              <StatCard label="Coverage" value={`${deviceCoverage}%`} hint={`${deviceActiveCount}/${devices.length} active`} />
              <StatCard label="Onboarding status" value={user?.onboardingStatus ?? "—"} />
              <StatCard label="Flow Records (24h)" value={flowCount24h.toLocaleString()} tooltip="Number of telemetry flow records ingested." />
              <StatCard label="Network Packets (24h)" value={(packets?.packet_count_total ?? packets?.today_total ?? 0).toLocaleString()} tooltip="Total packets reported across all flow records." />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.2fr]">
              <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-lg font-medium text-white">Quick actions</h2>
                <p className="mt-1 text-sm text-muted">Manage your OT deployment.</p>
                <div className="mt-4 grid gap-2">
                  {canViewDevices ? (
                    <QuickAction to="/dashboard/devices" label="Register assets" description="Add OT traffic sources." />
                  ) : null}
                  {canViewTraffic ? (
                    <QuickAction to="/dashboard/packets-analysed" label="Telemetry coverage" description="Traffic ingestion summary." />
                  ) : null}
                  {canViewAlerts ? (
                    <QuickAction to="/dashboard/alerts" label="Recent detections" description="Alerts in your environment." />
                  ) : null}
                  {canViewSocHealth ? (
                    <QuickAction to="/dashboard/soc-health" label="Deployment status" description="Health and monitoring." />
                  ) : null}
                </div>
              </article>

              <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-lg font-medium text-white">Asset coverage</h2>
                {devicesLoading ? <p className="mt-2 text-sm text-muted">Loading assets...</p> : null}
                {devicesError ? <p className="mt-2 text-sm text-danger">{devicesError}</p> : null}
                <div className="mt-3 space-y-2 text-sm">
                  {devices.slice(0, 5).map((device) => (
                    <div key={device.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-background/40 px-3 py-2">
                      <span className="text-white">{device.name}</span>
                      <span className={device.operational_state === "online" ? "text-emerald-400" : device.operational_state === "offline" ? "text-rose-400" : "text-muted"}>
                        {device.operational_state.charAt(0).toUpperCase() + device.operational_state.slice(1)}
                      </span>
                    </div>
                  ))}
                  {!devices.length ? <p className="text-sm text-muted">No devices registered yet.</p> : null}
                </div>
              </article>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-lg font-medium text-white">Protocol usage</h2>
                {packetsLoading ? <p className="mt-2 text-sm text-muted">Loading telemetry...</p> : null}
                {packetsError ? <p className="mt-2 text-sm text-danger">{packetsError}</p> : null}
                <div className="mt-3 space-y-2 text-sm">
                  {protocolMix.map((row) => (
                    <div key={row.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-background/40 px-3 py-2">
                      <span className="text-white">{row.label}</span>
                      <span className="text-muted">{row.value.toLocaleString()}</span>
                    </div>
                  ))}
                  {!protocolMix.length ? <p className="text-sm text-muted">No protocol data yet.</p> : null}
                </div>
              </article>

              <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-lg font-medium text-white">ML status overview</h2>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl border border-white/10 bg-background/40 p-3">
                    <p className="text-xs text-muted">Alerts (all time)</p>
                    <p className="mt-1 text-white">{totalAlertsAllTime}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-background/40 p-3">
                    <p className="text-xs text-muted">Avg risk</p>
                    <p className="mt-1 text-white">{meanRiskPct}%</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-background/40 p-3">
                    {/* flow records 24h = COUNT of telemetry rows (not packets) */}
                    <p className="text-xs text-muted">Flow records (24h)</p>
                    <p className="mt-1 text-white">{flowCount24h.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-background/40 p-3">
                    <p className="text-xs text-muted">Top ML status</p>
                    <p className="mt-1 text-white">
                      {Object.entries(summary?.ml_status_distribution ?? {})
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 1)
                        .map(([k]) => k)
                        .join(" ") || "—"}
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </>
        )}
      </section>
    );
}
