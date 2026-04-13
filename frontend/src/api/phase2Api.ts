import { apiClient } from "./client";

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

export type SecurityPosture = {
  system_uptime: string;
  blocked_ips_today: number;
  failed_logins: number;
  model_drift: string;
  incidents_open: number;
};

export async function fetchActiveThreats(): Promise<ActiveThreat[]> {
  const response = await apiClient.get<ActiveThreat[]>("/v1/alerts/active-threats");
  return response.data;
}

export async function fetchPacketsByHour(): Promise<PacketsByHourResponse> {
  const response = await apiClient.get<PacketsByHourResponse>("/v1/traffic/packets-by-hour");
  return response.data;
}

export async function fetchMttr(): Promise<MttrSummary> {
  const response = await apiClient.get<MttrSummary>("/v1/alerts/mttr");
  return response.data;
}

export async function fetchSecurityPosture(): Promise<SecurityPosture> {
  const response = await apiClient.get<SecurityPosture>("/v1/model/security-posture");
  return response.data;
}
