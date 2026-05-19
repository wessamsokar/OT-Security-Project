import os

file_path = 'c:/Users/ASUS/Documents/Semester 6/Project 2/ics/frontend/src/api/topologyApi.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'export async function fetchTopologySnapshot(): Promise<TopologySnapshot> {\n  try {\n    const response = await apiClient.get<TopologySnapshot>("/v1/topology/snapshot");\n    return response.data;',
    'export async function fetchTopologySnapshot(tenantId?: number): Promise<TopologySnapshot> {\n  try {\n    const response = await apiClient.get<TopologySnapshot>("/v1/topology/snapshot", {\n      params: tenantId ? { tenant_id: tenantId } : undefined\n    });\n    return response.data;'
)

content = content.replace(
    'export async function backfillTopologyTraffic(hours = 168): Promise<void> {\n  await apiClient.post("/v1/topology/backfill-traffic", null, { params: { hours } });\n}',
    'export async function backfillTopologyTraffic(hours = 168, tenantId?: number): Promise<void> {\n  const params: Record<string, unknown> = { hours };\n  if (tenantId) params.tenant_id = tenantId;\n  await apiClient.post("/v1/topology/backfill-traffic", null, { params });\n}'
)

content = content.replace(
    'export async function createTopologyEdge(payload: TopologyEdgeCreate): Promise<TopologyEdgeRecord> {\n  try {\n    const response = await apiClient.post<TopologyEdgeRecord>("/v1/topology/edges", payload);\n    return response.data;',
    'export async function createTopologyEdge(payload: TopologyEdgeCreate, tenantId?: number): Promise<TopologyEdgeRecord> {\n  try {\n    const response = await apiClient.post<TopologyEdgeRecord>("/v1/topology/edges", payload, {\n      params: tenantId ? { tenant_id: tenantId } : undefined\n    });\n    return response.data;'
)

content = content.replace(
    'export async function fetchEdgesForDevice(deviceId: number): Promise<TopologyEdgeRecord[]> {\n  try {\n    const response = await apiClient.get<TopologyEdgeRecord[]>(`/v1/topology/edges/device/${deviceId}`);\n    return response.data;',
    'export async function fetchEdgesForDevice(deviceId: number, tenantId?: number): Promise<TopologyEdgeRecord[]> {\n  try {\n    const response = await apiClient.get<TopologyEdgeRecord[]>(`/v1/topology/edges/device/${deviceId}`, {\n      params: tenantId ? { tenant_id: tenantId } : undefined\n    });\n    return response.data;'
)

content = content.replace(
    'export async function deleteTopologyEdge(edgeId: number): Promise<void> {\n  try {\n    await apiClient.delete(`/v1/topology/edges/${edgeId}`);\n  } catch (error) {',
    'export async function deleteTopologyEdge(edgeId: number, tenantId?: number): Promise<void> {\n  try {\n    await apiClient.delete(`/v1/topology/edges/${edgeId}`, {\n      params: tenantId ? { tenant_id: tenantId } : undefined\n    });\n  } catch (error) {'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
