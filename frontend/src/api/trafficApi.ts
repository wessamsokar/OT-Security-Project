import axios from "axios";

import { apiClient } from "./client";

/**
 * Traffic API — metric type conventions
 * ---------------------------------------
 * packet_count / packets : SUM of TrafficRecord.packet_count — actual network packets.
 *                          One flow record may carry many packets.
 *
 * flow_count             : COUNT of TrafficRecord rows — ingested telemetry records.
 *                          One per network flow session observed by a sensor.
 *
 * alert_count            : COUNT of Alert rows — ML-triggered security events.
 *                          Separate from both packet and flow counts.
 *
 * today_total            : DEPRECATED alias for packet_count_total. Use packet_count_total
 *                          in new code. Kept for backward compatibility only.
 */

type FastApiValidationError = {
  msg?: string;
};

type FastApiErrorResponse = {
  detail?: string | FastApiValidationError[];
  message?: string;
};

function parseTrafficApiError(error: unknown, fallbackMessage: string): Error {
  if (!axios.isAxiosError<FastApiErrorResponse>(error)) {
    return new Error(fallbackMessage);
  }

  const detail = error.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) {
    return new Error(detail);
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const firstMessage = detail.find((item) => item?.msg)?.msg;
    if (firstMessage?.trim()) {
      return new Error(firstMessage);
    }
  }

  const message = error.response?.data?.message;
  if (typeof message === "string" && message.trim()) {
    return new Error(message);
  }

  return new Error(fallbackMessage);
}

export type DetectionResponse = {
  record_id: number;
  risk_score: number | null;
  ml_status: string;
  alert_severity: string;
  attack_detected: boolean;
  device_id: number | null;
  attack_class: string;
  confidence: number;
  explanation: Record<string, unknown>;
  model_version: string | null;
};

export type TrafficRecordResponse = {
  id: number;
  source_ip: string;
  destination_ip: string;
  transport_protocol: string;
  device_id: number | null;
  ml_status: string | null;
  ml_alert_severity: string | null;
  ml_attack_detected: boolean | null;
  risk_score: number | null;
  attack_class: string | null;
  confidence: number | null;
  created_at: string;
};

export type ICSTrafficIn = {
  source_ip: string;
  destination_ip: string;
  source_port: number;
  destination_port: number;
  transport_protocol: "tcp" | "udp" | "icmp";
  packet_count: number;
  bytes_in: number;
  bytes_out: number;
  duration_ms: number;
  payload_entropy: number;
  modbus_function_code?: number | null;
  modbus_unit_id?: number | null;
  dnp3_function_code?: number | null;
  iec104_type_id?: number | null;
  ingestion_source?: "json" | "pcap";
  metadata_json?: Record<string, unknown>;
};

export type InventoryEdge = {
  device_a_id: number;
  device_b_id: number;
  /** Cumulative network packet count between this device pair (topology edge total). */
  packet_count: number;
};

/**
 * Per-hour traffic breakdown.
 *
 * packets    : SUM of actual network packets in this hour
 * flow_count : COUNT of telemetry flow records in this hour
 */
export type ProtocolVisibilityRow = {
  protocol: string;
  /** Network packet count (SUM of TrafficRecord.packet_count). NOT a flow count. */
  packets: number;
  last_seen_at: string | null;
};

export type ProtocolVisibilityResponse = {
  window_hours: number;
  /** Total network packets across all protocols (SUM). NOT a flow count. */
  total_packets: number;
  protocols: ProtocolVisibilityRow[];
};

/**
 * Rolling-window telemetry health.
 *
 * packets_last_*     : Actual network packets (SUM of TrafficRecord.packet_count)
 * flow_count_last_*  : Telemetry flow records ingested (COUNT of TrafficRecord rows)
 *
 * These are distinct metrics. flows ≠ packets.
 */
export type TelemetryHealthResponse = {
  window_minutes: number;

  /** Network packets (SUM) in the last 1 minute */
  packets_last_minute: number;
  /** Network packets (SUM) in the last 5 minutes */
  packets_last_5min: number;
  /** Network packets (SUM) in the last 15 minutes */
  packets_last_15min: number;
  /** Avg network packets per minute over the 15m window (not hardcoded 24*60) */
  avg_packets_per_minute_15m: number;

  /** Telemetry flow records ingested in the last 1 minute */
  flow_count_last_minute: number;
  /** Telemetry flow records ingested in the last 5 minutes */
  flow_count_last_5min: number;
  /** Telemetry flow records ingested in the last 15 minutes */
  flow_count_last_15min: number;

  last_traffic_at: string | null;
  dropped_packets: number | null;
};

export async function ingestTraffic(payload: ICSTrafficIn): Promise<TrafficRecordResponse> {
  try {
    const response = await apiClient.post<TrafficRecordResponse>("/v1/traffic/ingest", payload);
    return response.data;
  } catch (error) {
    throw parseTrafficApiError(error, "Unable to ingest traffic record.");
  }
}

export async function runDetection(recordId: number): Promise<DetectionResponse> {
  try {
    const response = await apiClient.post<DetectionResponse>(`/v1/traffic/${recordId}/detect`);
    return response.data;
  } catch (error) {
    throw parseTrafficApiError(error, "Unable to run ML detection on this record.");
  }
}

export async function fetchInventoryEdges(hours = 168, tenantId?: number): Promise<InventoryEdge[]> {
  try {
    const params: Record<string, unknown> = { hours };
    if (tenantId) params.tenant_id = tenantId;
    const response = await apiClient.get<InventoryEdge[]>("/v1/traffic/inventory-edges", { params });
    return response.data;
  } catch (error) {
    throw parseTrafficApiError(error, "Unable to load inventory flow edges.");
  }
}

export async function fetchProtocolVisibility(tenantId?: number): Promise<ProtocolVisibilityResponse> {
  try {
    const response = await apiClient.get<ProtocolVisibilityResponse>("/v1/traffic/protocol-distribution", {
      params: tenantId ? { tenant_id: tenantId } : undefined
    });
    return response.data;
  } catch (error) {
    throw parseTrafficApiError(error, "Unable to load protocol visibility.");
  }
}

export async function fetchTelemetryHealth(tenantId?: number): Promise<TelemetryHealthResponse> {
  try {
    const response = await apiClient.get<TelemetryHealthResponse>("/v1/traffic/health", {
      params: tenantId ? { tenant_id: tenantId } : undefined
    });
    return response.data;
  } catch (error) {
    throw parseTrafficApiError(error, "Unable to load telemetry health.");
  }
}
