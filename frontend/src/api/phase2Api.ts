import { apiClient } from "./client";

const API_TIMEOUT_MS = 15000;

export type ActiveThreat = {
  threat_id: string;
  attack_vector: string;
  target_asset: string;
  risk: string;
  created_at: string;
};

/**
 * Per-hour traffic row returned by GET /traffic/packets-by-hour.
 *
 * packets    : SUM of network packets in this hour (TrafficRecord.packet_count)
 * flow_count : COUNT of telemetry flow records in this hour (TrafficRecord rows)
 *
 * These are distinct metrics — a single flow record can carry many packets.
 */
export type PacketsByHourRow = {
  hour: string;
  /** Network packets (SUM of TrafficRecord.packet_count) for this hour */
  packets: number;
  /** Telemetry flow records (COUNT of TrafficRecord rows) for this hour */
  flow_count: number;
  dominant_protocol: string;
};

/**
 * 24-hour traffic telemetry summary from GET /traffic/packets-by-hour.
 *
 * Metric separation:
 *   packet_count_total : Total network packets in 24h — SUM(packet_count)
 *   flow_count_total   : Total flow records in 24h   — COUNT(rows)
 *   today_total        : DEPRECATED alias for packet_count_total (backward compat)
 *
 * avg_per_minute is calculated from actual elapsed time, not hardcoded 24*60.
 */
export type PacketsByHourResponse = {
  /** Total network packets in the last 24h (SUM of TrafficRecord.packet_count) */
  packet_count_total: number;
  /** Total telemetry flow records in the last 24h (COUNT of TrafficRecord rows) */
  flow_count_total: number;
  /**
   * @deprecated Use packet_count_total instead.
   * Kept for backward compatibility — equals packet_count_total.
   */
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

/**
 * SOC health payload from GET /model/soc-health.
 *
 * traffic_flows_in_window : COUNT of TrafficRecord rows in the rolling window.
 *                           This is a FLOW count, not a packet count.
 *                           Matches dashboard_summary.flows_last_24h when window=24h.
 */
export type SocHealthPayload = {
  window_hours: number;
  /** COUNT of telemetry flow records (TrafficRecord rows) in the window */
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
