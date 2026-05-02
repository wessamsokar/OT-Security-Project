import { apiClient } from "./client";

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

export async function fetchDevices(): Promise<DeviceResponse[]> {
  const response = await apiClient.get<DeviceResponse[]>("/v1/devices");
  return response.data;
}

export async function fetchMyDevices(): Promise<DeviceResponse[]> {
  const response = await apiClient.get<DeviceResponse[]>("/v1/devices/me");
  return response.data;
}

export async function createDevice(payload: DeviceCreate): Promise<DeviceResponse> {
  const response = await apiClient.post<DeviceResponse>("/v1/devices", payload);
  return response.data;
}

export async function updateDevice(deviceId: number, payload: DeviceUpdate): Promise<DeviceResponse> {
  const response = await apiClient.put<DeviceResponse>(`/v1/devices/${deviceId}`, payload);
  return response.data;
}

export async function deleteDevice(deviceId: number): Promise<void> {
  await apiClient.delete(`/v1/devices/${deviceId}`);
}
