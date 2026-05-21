import { apiClient } from "./client";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export type AlertResponse = {
  id: number;
  traffic_record_id: number;
  severity: AlertSeverity;
  status: "new" | "investigating" | "closed";
  summary: string;
  created_at: string;
};

/**
 * Dashboard summary aggregates from GET /api/v1/alerts/dashboard.
 *
 * Metric separation:
 *   total_records          : ALL-TIME count of TrafficRecord rows (historical context).
 *   flows_last_24h         : COUNT of TrafficRecord rows in the last 24h (operational).
 *                            Matches soc-health traffic_flows_in_window (same window).
 *   total_packet_count_24h : SUM of TrafficRecord.packet_count in the last 24h.
 *                            Actual network packets — NOT flow count.
 *   total_alerts           : ALL-TIME count of Alert rows (not windowed).
 */
export type DashboardSummary = {
  /** ALL-TIME telemetry row count (historical) */
  total_records: number;
  /** COUNT of telemetry flow records in the last 24h (operational, windowed) */
  flows_last_24h: number;
  /** SUM of network packets (TrafficRecord.packet_count) in the last 24h */
  total_packet_count_24h: number;
  /** ALL-TIME alert count */
  total_alerts: number;
  incidents_open: number;
  avg_risk_score: number;
  class_distribution: Record<string, number>;
  /** Present on API v2 dashboard; older snapshots may omit (treat as {}). */
  ml_status_distribution?: Record<string, number>;
};

const API_TIMEOUT_MS = 8000;

export async function fetchAlerts(tenantId?: number): Promise<AlertResponse[]> {
  const response = await apiClient.get<AlertResponse[]>("/v1/alerts", {
    params: tenantId ? { tenant_id: tenantId } : undefined,
    timeout: API_TIMEOUT_MS
  });
  return response.data;
}

export async function fetchDashboardSummary(tenantId?: number): Promise<DashboardSummary> {
  const response = await apiClient.get<DashboardSummary>("/v1/alerts/dashboard", {
    params: tenantId ? { tenant_id: tenantId } : undefined,
    timeout: API_TIMEOUT_MS
  });
  return response.data;
}
