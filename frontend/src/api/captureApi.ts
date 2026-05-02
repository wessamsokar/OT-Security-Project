import { apiClient } from "./client";

export type PacketCaptureRequest = {
  interface?: string | null;
  duration_seconds?: number;
  packet_count?: number | null;
  bpf_filter?: string | null;
  output_filename?: string | null;
};

export type PacketCaptureResponse = {
  capture_id: string;
  status: string;
  file_path: string;
};

export type PacketCaptureStatusResponse = {
  capture_id: string;
  status: string;
};

export async function startPacketCapture(payload: PacketCaptureRequest): Promise<PacketCaptureResponse> {
  const response = await apiClient.post<PacketCaptureResponse>("/v1/packet-capture", payload);
  return response.data;
}

export async function stopPacketCapture(captureId: string): Promise<PacketCaptureStatusResponse> {
  const response = await apiClient.post<PacketCaptureStatusResponse>("/v1/packet-capture/stop", {
    capture_id: captureId
  });
  return response.data;
}

export async function getPacketCaptureStatus(captureId: string): Promise<PacketCaptureStatusResponse> {
  const response = await apiClient.get<PacketCaptureStatusResponse>(`/v1/packet-capture/${captureId}/status`);
  return response.data;
}
