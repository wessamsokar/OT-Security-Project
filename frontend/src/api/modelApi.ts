import { apiClient } from "./client";

export type ModelVersionResponse = {
  id: number;
  version: string;
  label: string;
  metrics_json: Record<string, unknown>;
  trained_by: string;
  is_active: boolean;
  created_at: string;
};

export async function fetchModelVersions(): Promise<ModelVersionResponse[]> {
  const response = await apiClient.get<ModelVersionResponse[]>("/v1/model/versions");
  return response.data;
}
