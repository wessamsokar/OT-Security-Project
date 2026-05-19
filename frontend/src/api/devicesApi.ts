import { apiClient } from "./client";

const API_TIMEOUT_MS = 8000;

export type DeviceResponse = {
  id: number;
  user_id: number;
  name: string;
  device_type: string | null;
  ip_address: string | null;
  serial_number: string | null;
  location: string | null;
  metadata_json: Record<string, unknown>;
  is_active: boolean;
  /** Last ML risk score (0–1) from traffic analysis; server-owned. */
  last_ml_risk_score: number | null;
  last_ml_status: string | null;
  monitoring_status: string;
  operational_state: string;
  last_traffic_at: string | null;
  last_seen_traffic_id: number | null;
  created_at: string;
  updated_at: string;
};

export type DeviceCreate = {
  name: string;
  device_type?: string | null;
  ip_address?: string | null;
  serial_number?: string | null;
  location?: string | null;
  metadata_json?: Record<string, unknown>;
  is_active?: boolean;
};

export type DeviceUpdate = {
  name?: string | null;
  device_type?: string | null;
  ip_address?: string | null;
  serial_number?: string | null;
  location?: string | null;
  metadata_json?: Record<string, unknown> | null;
  is_active?: boolean | null;
};

export async function fetchDevices(tenantId?: number): Promise<DeviceResponse[]> {
  const response = await apiClient.get<DeviceResponse[]>("/v1/devices", {
    params: tenantId ? { tenant_id: tenantId } : undefined,
    timeout: API_TIMEOUT_MS
  });
  return response.data;
}

export async function fetchMyDevices(): Promise<DeviceResponse[]> {
  const response = await apiClient.get<DeviceResponse[]>("/v1/devices/me", {
    timeout: API_TIMEOUT_MS
  });
  return response.data;
}

export async function createDevice(payload: DeviceCreate): Promise<DeviceResponse> {
  const response = await apiClient.post<DeviceResponse>("/v1/devices", payload, {
    timeout: API_TIMEOUT_MS
  });
  return response.data;
}

export async function updateDevice(deviceId: number, payload: DeviceUpdate): Promise<DeviceResponse> {
  const response = await apiClient.put<DeviceResponse>(`/v1/devices/${deviceId}`, payload, {
    timeout: API_TIMEOUT_MS
  });
  return response.data;
}

export async function deleteDevice(deviceId: number): Promise<void> {
  await apiClient.delete(`/v1/devices/${deviceId}`);
}
