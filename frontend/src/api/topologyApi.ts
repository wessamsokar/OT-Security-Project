import axios from "axios";

import { apiClient } from "./client";

const API_TIMEOUT_MS = 8000;

export type TopologyRelationshipType =
  | "connected_to"
  | "upstream"
  | "downstream"
  | "peer"
  | "parent";

export type TopologyEdgeRecord = {
  id: number;
  source_device_id: number;
  target_device_id: number;
  source_name: string | null;
  target_name: string | null;
  relationship_type: TopologyRelationshipType;
  direction: "forward" | "reverse" | "bidirectional";
  protocol_context: string | null;
  metadata_json: Record<string, unknown>;
  packet_count: number;
  bytes_total: number;
  is_active: boolean;
  edge_source: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
};

export type TopologyNodeSnapshot = {
  device_id: number;
  name: string;
  ip_address: string | null;
  device_type: string | null;
  operational_state: string;
  monitoring_status: string;
  last_traffic_at: string | null;
  last_ml_risk_score: number | null;
  last_ml_status: string | null;
  metadata_json: Record<string, unknown>;
  is_active: boolean;
};

export type TopologyEdgeActivity = {
  edge_id: number;
  active: boolean;
  packet_count: number;
  last_seen_at: string | null;
};

export type TopologySnapshot = {
  timestamp: string;
  seq?: number;
  nodes: TopologyNodeSnapshot[];
  edges: TopologyEdgeRecord[];
  edge_activity: TopologyEdgeActivity[];
};

export type TopologyEdgeCreate = {
  source_device_id: number;
  target_device_id: number;
  relationship_type: TopologyRelationshipType;
  direction?: "forward" | "reverse" | "bidirectional";
  protocol_context?: string | null;
  metadata_json?: Record<string, unknown>;
};

export async function fetchTopologySnapshot(tenantId?: number): Promise<TopologySnapshot> {
  try {
    const response = await apiClient.get<TopologySnapshot>("/v1/topology/snapshot", {
      params: tenantId ? { tenant_id: tenantId } : undefined,
      timeout: API_TIMEOUT_MS
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail;
      if (typeof detail === "string") throw new Error(detail);
    }
    throw new Error("Unable to load topology snapshot.");
  }
}

export async function backfillTopologyTraffic(hours = 168, tenantId?: number): Promise<void> {
  const params: Record<string, unknown> = { hours };
  if (tenantId) params.tenant_id = tenantId;
  await apiClient.post("/v1/topology/backfill-traffic", null, { params, timeout: API_TIMEOUT_MS });
}

export async function createTopologyEdge(payload: TopologyEdgeCreate, tenantId?: number): Promise<TopologyEdgeRecord> {
  try {
    const response = await apiClient.post<TopologyEdgeRecord>("/v1/topology/edges", payload, {
      params: tenantId ? { tenant_id: tenantId } : undefined,
      timeout: API_TIMEOUT_MS
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail;
      if (typeof detail === "string") throw new Error(detail);
    }
    throw new Error("Unable to create relationship.");
  }
}

export async function fetchEdgesForDevice(deviceId: number, tenantId?: number): Promise<TopologyEdgeRecord[]> {
  try {
    const response = await apiClient.get<TopologyEdgeRecord[]>(`/v1/topology/edges/device/${deviceId}`, {
      params: tenantId ? { tenant_id: tenantId } : undefined,
      timeout: API_TIMEOUT_MS
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail;
      if (typeof detail === "string") throw new Error(detail);
    }
    throw new Error("Unable to load device relationships.");
  }
}

export async function deleteTopologyEdge(edgeId: number, tenantId?: number): Promise<void> {
  try {
    await apiClient.delete(`/v1/topology/edges/${edgeId}`, {
      params: tenantId ? { tenant_id: tenantId } : undefined,
      timeout: API_TIMEOUT_MS
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail;
      if (typeof detail === "string") throw new Error(detail);
    }
    throw new Error("Unable to delete relationship.");
  }
}
