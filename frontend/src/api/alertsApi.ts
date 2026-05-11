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

export type DashboardSummary = {
  total_records: number;
  total_alerts: number;
  incidents_open: number;
  avg_risk_score: number;
  class_distribution: Record<string, number>;
  /** Present on API v2 dashboard; older snapshots may omit (treat as {}). */
  ml_status_distribution?: Record<string, number>;
};

export async function fetchAlerts(): Promise<AlertResponse[]> {
  const response = await apiClient.get<AlertResponse[]>("/v1/alerts");
  return response.data;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const response = await apiClient.get<DashboardSummary>("/v1/alerts/dashboard");
  return response.data;
}
