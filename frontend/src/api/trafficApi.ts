import axios from "axios";

import { apiClient } from "./client";

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
