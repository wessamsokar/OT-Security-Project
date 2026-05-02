import { apiClient } from "./client";
import type { DashboardSummary } from "./alertsApi";
import type { ActiveThreat } from "./phase2Api";

export type LiveSnapshotResponse = {
  dashboard: DashboardSummary;
  active_threats: ActiveThreat[];
  updated_at: string;
};

export async function fetchPublicLiveSnapshot(): Promise<LiveSnapshotResponse> {
  const response = await apiClient.get<LiveSnapshotResponse>("/v1/public/live-snapshot");
  return response.data;
}
