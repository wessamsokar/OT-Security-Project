import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AlertResponse, DashboardSummary } from "../api/alertsApi";
import type { ActiveThreat } from "../api/phase2Api";
import type { ProtocolVisibilityResponse, TelemetryHealthResponse } from "../api/trafficApi";
import { connectAlertsStream } from "../api/streamApi";
import { fetchActiveThreats } from "../api/phase2Api";
import { fetchProtocolVisibility, fetchTelemetryHealth } from "../api/trafficApi";
import { TopologyProvider, useTopologyStore } from "../components/topology/topologyStore";
import { useTopologyLive } from "../components/topology/useTopologyLive";
import { SocHealthOverview } from "../components/socHealth/SocHealthOverview";
import { ThreatOperationsPanel } from "../components/socHealth/ThreatOperationsPanel";
import { ProtocolVisibilityPanel } from "../components/socHealth/ProtocolVisibilityPanel";
import { TelemetryHealthPanel } from "../components/socHealth/TelemetryHealthPanel";
import { TopologyHealthPanel } from "../components/socHealth/TopologyHealthPanel";
import { SocActivityFeed, type SocActivityEvent } from "../components/socHealth/SocActivityFeed";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";

function SocHealthContent() {
  const { hasPermission, user } = useAuth();
  const { activeTenantId, canSelectTenant } = useTenant();
  const tenantId = canSelectTenant ? activeTenantId : undefined;

  const canViewSocHealth = hasPermission("view_soc_health");
  const canViewTraffic = hasPermission("view_traffic");
  const canViewAlerts = hasPermission("view_alerts");
  const canViewStreams = hasPermission("view_streams");
  const role = user?.role ?? "customer";

  const { loading: topologyLoading, error: topologyError } = useTopologyLive(tenantId, {
    enabled: canViewSocHealth && canViewTraffic
  });
  const { devices, edges, edgeActivity, liveConnected } = useTopologyStore();

  const [alerts, setAlerts] = useState<AlertResponse[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [alertsError, setAlertsError] = useState("");
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsConnected, setAlertsConnected] = useState(false);

  const [activeThreats, setActiveThreats] = useState<ActiveThreat[]>([]);
  const [threatsLoading, setThreatsLoading] = useState(true);
  const [threatsError, setThreatsError] = useState("");

  const [protocols, setProtocols] = useState<ProtocolVisibilityResponse | null>(null);
  const [protocolLoading, setProtocolLoading] = useState(true);
  const [protocolError, setProtocolError] = useState("");

  const [telemetryHealth, setTelemetryHealth] = useState<TelemetryHealthResponse | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState(true);
  const [telemetryError, setTelemetryError] = useState("");

  const [events, setEvents] = useState<SocActivityEvent[]>([]);
  const eventRef = useRef<Map<string, boolean>>(new Map());
  const deviceStateRef = useRef<Map<number, string>>(new Map());
  const edgeActiveRef = useRef<Map<number, boolean>>(new Map());
  const alertsErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const telemetryStatusRef = useRef<string | null>(null);
  const alertsThrottleRef = useRef<number | null>(null);
  const pendingAlertsRef = useRef<{ alerts: AlertResponse[]; dashboard: DashboardSummary } | null>(null);

  const addEvent = useCallback((event: SocActivityEvent) => {
    if (eventRef.current.has(event.id)) return;
    eventRef.current.set(event.id, true);
    setEvents((prev) => [event, ...prev].slice(0, 40));
  }, []);

  useEffect(() => {
    if (!canViewSocHealth || !canViewAlerts || !canViewStreams) {
      setAlertsLoading(false);
      return;
    }
    let active = true;
    setAlertsLoading(true);

    const source = connectAlertsStream(
      (snapshot) => {
        if (!active) return;
        if (alertsErrorTimerRef.current) {
          clearTimeout(alertsErrorTimerRef.current);
          alertsErrorTimerRef.current = null;
        }
        pendingAlertsRef.current = { alerts: snapshot.alerts, dashboard: snapshot.dashboard };
        if (alertsThrottleRef.current != null) return;
        alertsThrottleRef.current = window.setTimeout(() => {
          alertsThrottleRef.current = null;
          const pending = pendingAlertsRef.current;
          if (!pending) return;
          pendingAlertsRef.current = null;
          setAlerts(pending.alerts);
          setDashboard(pending.dashboard);
          setAlertsError("");
          setAlertsConnected(true);
          setAlertsLoading(false);
        }, 400);
      },
      () => {
        if (!active) return;
        setAlertsConnected(false);
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
      source?.close();
    };
  }, [canViewAlerts, canViewStreams, canViewSocHealth, tenantId]);

  useEffect(() => {
    if (!canViewSocHealth || !canViewAlerts) {
      setThreatsLoading(false);
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const rows = await fetchActiveThreats(tenantId);
        if (!active) return;
        setActiveThreats(rows);
        setThreatsError("");
      } catch (err) {
        if (!active) return;
        setThreatsError(err instanceof Error ? err.message : "Unable to load active threats.");
      } finally {
        if (active) setThreatsLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [canViewAlerts, canViewSocHealth, tenantId]);

  useEffect(() => {
    if (!canViewSocHealth || !canViewTraffic) {
      setProtocolLoading(false);
      setTelemetryLoading(false);
      return;
    }
    let active = true;
    const loadProtocols = async () => {
      try {
        const data = await fetchProtocolVisibility(tenantId);
        if (!active) return;
        setProtocols(data);
        setProtocolError("");
      } catch (err) {
        if (!active) return;
        setProtocolError(err instanceof Error ? err.message : "Unable to load protocols.");
      } finally {
        if (active) setProtocolLoading(false);
      }
    };
    const loadTelemetry = async () => {
      try {
        const data = await fetchTelemetryHealth(tenantId);
        if (!active) return;
        setTelemetryHealth(data);
        setTelemetryError("");
      } catch (err) {
        if (!active) return;
        setTelemetryError(err instanceof Error ? err.message : "Unable to load telemetry health.");
      } finally {
        if (active) setTelemetryLoading(false);
      }
    };
    void loadProtocols();
    void loadTelemetry();
    const timer = window.setInterval(() => {
      void loadProtocols();
      void loadTelemetry();
    }, 20000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [canViewTraffic, canViewSocHealth, tenantId]);

  useEffect(() => {
    const newEvents: SocActivityEvent[] = [];
    const now = new Date();
    devices.forEach((device) => {
      const prev = deviceStateRef.current.get(device.id);
      const state = (device.operational_state || "unknown").toLowerCase();
      if (prev && prev !== state) {
        const severity = state === "anomalous" ? "critical" : state === "degraded" ? "warning" : "info";
        newEvents.push({
          id: `device-${device.id}-${state}-${now.toISOString()}`,
          title: `${device.name} became ${state.replace("_", " ")}`,
          detail: `Operational state changed to ${state}.`,
          timestamp: now.toISOString(),
          severity
        });
      }
      deviceStateRef.current.set(device.id, state);
    });

    edges.forEach((edge) => {
      const activity = edgeActivity.get(edge.id);
      const active = Boolean(activity?.active ?? edge.is_active);
      const prevActive = edgeActiveRef.current.get(edge.id);
      if (prevActive === undefined && active) {
        newEvents.push({
          id: `edge-${edge.id}-active`,
          title: "New topology relationship observed",
          detail: `${edge.source_name ?? "Asset"} → ${edge.target_name ?? "Asset"} active`,
          timestamp: now.toISOString(),
          severity: "info"
        });
      }
      if (prevActive === false && active) {
        newEvents.push({
          id: `edge-${edge.id}-reactive-${now.toISOString()}`,
          title: "Edge activity resumed",
          detail: `${edge.source_name ?? "Asset"} → ${edge.target_name ?? "Asset"} active`,
          timestamp: now.toISOString(),
          severity: "info"
        });
      }
      edgeActiveRef.current.set(edge.id, active);
    });

    newEvents.slice(0, 4).forEach(addEvent);
  }, [devices, edges, edgeActivity, addEvent]);

  useEffect(() => {
    alerts.slice(0, 5).forEach((alert) => {
      addEvent({
        id: `alert-${alert.id}`,
        title: `New ${alert.severity} alert`,
        detail: alert.summary,
        timestamp: alert.created_at,
        severity: alert.severity === "critical" || alert.severity === "high" ? "critical" : "warning"
      });
    });
  }, [alerts, addEvent]);

  useEffect(() => {
    if (!telemetryHealth?.last_traffic_at) return;
    const lastSeen = new Date(telemetryHealth.last_traffic_at);
    const minutesSince = Math.round((Date.now() - lastSeen.getTime()) / 60000);
    const status = minutesSince <= 2 ? "healthy" : minutesSince <= 10 ? "degraded" : "stalled";
    if (telemetryStatusRef.current && telemetryStatusRef.current !== status) {
      const severity = status === "healthy" ? "info" : status === "degraded" ? "warning" : "critical";
      addEvent({
        id: `telemetry-${status}-${telemetryHealth.last_traffic_at}`,
        title: "Telemetry pipeline status changed",
        detail: `Ingestion is now ${status}.`,
        timestamp: new Date().toISOString(),
        severity
      });
    }
    telemetryStatusRef.current = status;
  }, [telemetryHealth, addEvent]);

  const operationalCounts = useMemo(() => {
    const counts = {
      online: 0,
      offline: 0,
      degraded: 0,
      anomalous: 0,
      capture_enabled: 0
    };
    devices.forEach((device) => {
      const state = (device.operational_state || "unknown").toLowerCase();
      if (state in counts) {
        counts[state as keyof typeof counts] += 1;
      }
    });
    return counts;
  }, [devices]);

  const totalDevices = devices.length;
  const lastTelemetryAt = useMemo(() => {
    if (telemetryHealth?.last_traffic_at) return telemetryHealth.last_traffic_at;
    const timestamps = devices
      .map((device) => device.last_traffic_at)
      .filter((value): value is string => Boolean(value));
    if (timestamps.length === 0) return null;
    return timestamps.sort().reverse()[0];
  }, [telemetryHealth, devices]);

  const anomalousAssets = operationalCounts.anomalous;

  const isViewer = role === "viewer";
  const showThreats = canViewAlerts && (role === "admin" || role === "analyst" || role === "customer");
  const showTelemetry = canViewTraffic;
  const showTopology = canViewTraffic;

  return (
    <div className="space-y-6">
      {!canViewSocHealth ? (
        <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 text-sm text-muted shadow-panel">
          SOC Health access is restricted for your role.
        </section>
      ) : null}

      {canViewSocHealth ? (
        <>
      <SocHealthOverview
        counts={operationalCounts}
        total={totalDevices}
        lastTelemetryAt={lastTelemetryAt}
        streamState={{ alertsConnected, topologyConnected: liveConnected }}
        loading={topologyLoading && totalDevices === 0}
      />

      {topologyError ? <p className="text-sm text-rose-200">{topologyError}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
        <div className="space-y-6">
          {showTelemetry ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <ProtocolVisibilityPanel data={protocols} loading={protocolLoading} error={protocolError} />
              <TelemetryHealthPanel
                data={telemetryHealth}
                loading={telemetryLoading}
                error={telemetryError}
                alertsConnected={alertsConnected}
                topologyConnected={liveConnected}
              />
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-panel/45 p-6 text-sm text-muted shadow-panel">
              Telemetry visibility is restricted for your role.
            </div>
          )}

          {showThreats && !isViewer ? (
            <ThreatOperationsPanel
              alerts={alerts}
              activeThreats={activeThreats}
              dashboard={dashboard}
              anomalousAssets={anomalousAssets}
              loading={threatsLoading || alertsLoading}
              error={threatsError || alertsError}
            />
          ) : null}
        </div>

        <div className="relative">
          <div className="sticky top-6">
            <SocActivityFeed events={events} loading={alertsLoading && topologyLoading} />
          </div>
        </div>
      </div>

      {showTopology ? (
        <TopologyHealthPanel
          devices={devices}
          edges={edges}
          edgeActivity={edgeActivity}
          loading={topologyLoading}
        />
      ) : null}
        </>
      ) : null}
    </div>
  );
}

export function SocHealthPage() {
  return (
    <TopologyProvider>
      <SocHealthContent />
    </TopologyProvider>
  );
}
