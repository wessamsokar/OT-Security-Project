import { apiClient } from "./client";

const API_TIMEOUT_MS = 15000;

export type ActiveThreat = {
  threat_id: string;
  attack_vector: string;
  target_asset: string;
  risk: string;
  created_at: string;
};

export type PacketsByHourRow = {
  hour: string;
  packets: number;
  dominant_protocol: string;
};

export type PacketsByHourResponse = {
  today_total: number;
  avg_per_minute: number;
  peak_hour: string;
  rows: PacketsByHourRow[];
};

export type MttrIncident = {
  incident_id: string;
  opened_at: string;
  resolved_at: string | null;
  status: string;
  mttr_minutes: number;
};

export type MttrSummary = {
  average_mttr_minutes: number;
  target_sla_minutes: number;
  incidents: MttrIncident[];
};

export type SocHealthPayload = {
  window_hours: number;
  traffic_flows_in_window: number;
  ml_status_counts: Record<string, number>;
  traffic_attack_detected_count: number;
  alerts_severity_counts: Record<string, number>;
  devices_registered: number;
  monitoring_status_counts: Record<string, number>;
  avg_last_ml_risk_score: number | null;
};

export async function fetchActiveThreats(tenantId?: number): Promise<ActiveThreat[]> {
  const response = await apiClient.get<ActiveThreat[]>("/v1/alerts/active-threats", {
    params: tenantId ? { tenant_id: tenantId } : undefined,
    timeout: API_TIMEOUT_MS
  });
  return response.data;
}

export async function fetchPacketsByHour(tenantId?: number): Promise<PacketsByHourResponse> {
  const response = await apiClient.get<PacketsByHourResponse>("/v1/traffic/packets-by-hour", {
    params: tenantId ? { tenant_id: tenantId } : undefined,
    timeout: API_TIMEOUT_MS
  });
  return response.data;
}

export async function fetchMttr(tenantId?: number): Promise<MttrSummary> {
  const response = await apiClient.get<MttrSummary>("/v1/alerts/mttr", {
    params: tenantId ? { tenant_id: tenantId } : undefined,
    timeout: API_TIMEOUT_MS
  });
  return response.data;
}

export async function fetchSocHealth(tenantId?: number): Promise<SocHealthPayload> {
  const response = await apiClient.get<SocHealthPayload>("/v1/model/soc-health", {
    params: tenantId ? { tenant_id: tenantId } : undefined,
    timeout: API_TIMEOUT_MS
  });
  return response.data;
}
