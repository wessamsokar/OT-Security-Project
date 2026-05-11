import { apiClient } from "./client";
import type { AlertResponse } from "./alertsApi";
import type { DeviceResponse } from "./devicesApi";
import type { TrafficRecordResponse } from "./trafficApi";

export type OnboardingStatus = "pending" | "approved" | "rejected";

export type UserAdminResponse = {
  id: number;
  username: string;
  email: string;
  role: "admin" | "customer";
  is_active: boolean;
  is_email_verified: boolean;
  email_verified_at: string | null;
  is_admin_approved: boolean;
  admin_approved_at: string | null;
  onboarding_status: OnboardingStatus;
  rejected_at: string | null;
  company_name: string | null;
  job_title: string | null;
  industry_type: string | null;
  infrastructure_type: string | null;
  estimated_device_count: number | null;
  country: string | null;
  purpose_of_access: string | null;
  operates_ot_ics: boolean | null;
  created_at: string;
};

export type UserCreate = {
  username: string;
  email: string;
  password: string;
  role?: "admin" | "customer";
  is_active?: boolean;
  is_email_verified?: boolean;
  /** Default true: admin-created users can sign in immediately */
  is_admin_approved?: boolean;
};

export type UserUpdate = {
  username?: string;
  email?: string;
  password?: string;
  role?: "admin" | "customer";
  is_active?: boolean;
  is_email_verified?: boolean;
  is_admin_approved?: boolean;
};

export type IncidentResponse = {
  id: number;
  alert_id: number;
  title: string;
  owner: string;
  status: "open" | "triaged" | "resolved";
  created_at: string;
};

export type ActiveThreatResponse = {
  threat_id: string;
  attack_vector: string;
  target_asset: string;
  risk: string;
  created_at: string;
};

export async function fetchUsers(query?: string): Promise<UserAdminResponse[]> {
  const response = await apiClient.get<UserAdminResponse[]>("/v1/users", {
    params: query ? { q: query } : undefined
  });
  return response.data;
}

export async function fetchUser(userId: number): Promise<UserAdminResponse> {
  const response = await apiClient.get<UserAdminResponse>(`/v1/users/${userId}`);
  return response.data;
}

export async function createUser(payload: UserCreate): Promise<UserAdminResponse> {
  const response = await apiClient.post<UserAdminResponse>("/v1/users", payload);
  return response.data;
}

export async function updateUser(userId: number, payload: UserUpdate): Promise<UserAdminResponse> {
  const response = await apiClient.put<UserAdminResponse>(`/v1/users/${userId}`, payload);
  return response.data;
}

export async function approveOnboardingRegistration(userId: number): Promise<UserAdminResponse> {
  const response = await apiClient.post<UserAdminResponse>(`/v1/users/${userId}/onboarding/approve`);
  return response.data;
}

export async function rejectOnboardingRegistration(
  userId: number,
  reason?: string
): Promise<UserAdminResponse> {
  const response = await apiClient.post<UserAdminResponse>(`/v1/users/${userId}/onboarding/reject`, {
    reason: reason?.trim() || null
  });
  return response.data;
}

export async function deleteUser(userId: number): Promise<void> {
  await apiClient.delete(`/v1/users/${userId}`);
}

export async function fetchUserDevices(userId: number, limit = 50): Promise<DeviceResponse[]> {
  const response = await apiClient.get<DeviceResponse[]>(`/v1/users/${userId}/devices`, {
    params: { limit }
  });
  return response.data;
}

export async function fetchUserAlerts(userId: number, limit = 50): Promise<AlertResponse[]> {
  const response = await apiClient.get<AlertResponse[]>(`/v1/users/${userId}/alerts`, {
    params: { limit }
  });
  return response.data;
}

export async function fetchUserThreats(userId: number, limit = 50): Promise<ActiveThreatResponse[]> {
  const response = await apiClient.get<ActiveThreatResponse[]>(`/v1/users/${userId}/threats`, {
    params: { limit }
  });
  return response.data;
}

export async function fetchUserIncidents(userId: number, limit = 50): Promise<IncidentResponse[]> {
  const response = await apiClient.get<IncidentResponse[]>(`/v1/users/${userId}/incidents`, {
    params: { limit }
  });
  return response.data;
}

export async function fetchUserTraffic(userId: number, limit = 50): Promise<TrafficRecordResponse[]> {
  const response = await apiClient.get<TrafficRecordResponse[]>(`/v1/users/${userId}/traffic`, {
    params: { limit }
  });
  return response.data;
}
