import { apiClient } from "./client";

export type DetectionResponse = {
  record_id: number;
  risk_score: number;
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
  const response = await apiClient.post<TrafficRecordResponse>("/v1/traffic/ingest", payload);
  return response.data;
}

export async function runDetection(recordId: number): Promise<DetectionResponse> {
  const response = await apiClient.post<DetectionResponse>(`/v1/traffic/${recordId}/detect`);
  return response.data;
}
