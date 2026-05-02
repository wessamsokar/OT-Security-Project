import { apiClient } from "./client";

export type UserAdminResponse = {
  id: number;
  username: string;
  email: string;
  role: "admin" | "customer";
  is_active: boolean;
  is_email_verified: boolean;
  email_verified_at: string | null;
  created_at: string;
};

export type UserCreate = {
  username: string;
  email: string;
  password: string;
  role?: "admin" | "customer";
  is_active?: boolean;
  is_email_verified?: boolean;
};

export type UserUpdate = {
  username?: string;
  email?: string;
  password?: string;
  role?: "admin" | "customer";
  is_active?: boolean;
  is_email_verified?: boolean;
};

export async function fetchUsers(query?: string): Promise<UserAdminResponse[]> {
  const response = await apiClient.get<UserAdminResponse[]>("/v1/users", {
    params: query ? { q: query } : undefined
  });
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

export async function deleteUser(userId: number): Promise<void> {
  await apiClient.delete(`/v1/users/${userId}`);
}
