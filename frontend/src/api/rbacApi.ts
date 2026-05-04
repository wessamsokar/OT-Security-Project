import { apiClient } from "./client";

export type RoleResponse = {
  id: number;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
};

export type RoleSummary = {
  id: number;
  name: string;
};

export type UserRolesResponse = {
  user_id: number;
  roles: RoleSummary[];
};

export type RoleCreate = {
  name: string;
  description?: string | null;
};

export type RoleUpdate = {
  name?: string | null;
  description?: string | null;
};

export async function fetchRoles(): Promise<RoleResponse[]> {
  const response = await apiClient.get<RoleResponse[]>("/v1/rbac/roles");
  return response.data;
}

export async function fetchRole(roleId: number): Promise<RoleResponse> {
  const response = await apiClient.get<RoleResponse>(`/v1/rbac/roles/${roleId}`);
  return response.data;
}

export async function createRole(payload: RoleCreate): Promise<RoleResponse> {
  const response = await apiClient.post<RoleResponse>("/v1/rbac/roles", payload);
  return response.data;
}

export async function updateRole(roleId: number, payload: RoleUpdate): Promise<RoleResponse> {
  const response = await apiClient.put<RoleResponse>(`/v1/rbac/roles/${roleId}`, payload);
  return response.data;
}

export async function deleteRole(roleId: number): Promise<void> {
  await apiClient.delete(`/v1/rbac/roles/${roleId}`);
}

export async function fetchUserRoles(userId: number): Promise<UserRolesResponse> {
  const response = await apiClient.get<UserRolesResponse>(`/v1/rbac/users/${userId}/roles`);
  return response.data;
}

export async function updateUserRoles(userId: number, roleIds: number[]): Promise<UserRolesResponse> {
  const response = await apiClient.put<UserRolesResponse>(`/v1/rbac/users/${userId}/roles`, {
    role_ids: roleIds
  });
  return response.data;
}
