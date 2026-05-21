import type { Edge, Node } from "reactflow";

import type { DeviceResponse } from "../../api/devicesApi";
import type { TopologyEdgeRecord } from "../../api/topologyApi";

import type { OperationalState } from "./topologyStore";

export type TopologyNodeData = {
  deviceId: number;
  name: string;
  ip: string | null;
  deviceType: string | null;
  protocol: string | null;
  status: OperationalState;
  riskScore: number | null;
  lastTrafficAt: string | null;
  pulseSpeed: number;
};

export type TopologyEdgeData = {
  edgeId: number;
  packetCount: number;
  protocolHint: string | null;
  relationshipType: string;
  direction: string;
  active: boolean;
  animated: boolean;
};

const GRID_COLS = 5;
const GRID_GAP_X = 220;
const GRID_GAP_Y = 150;
const GRID_START_X = 80;
const GRID_START_Y = 80;

function readProtocol(metadata: Record<string, unknown>): string | null {
  const raw = metadata?.protocol_type;
  return typeof raw === "string" ? raw : null;
}

export function mapOperationalState(device: DeviceResponse): OperationalState {
  const raw = (device.operational_state || "").toLowerCase();
  if (
    raw === "online" ||
    raw === "offline" ||
    raw === "unknown" ||
    raw === "inactive" ||
    raw === "anomalous" ||
    raw === "degraded" ||
    raw === "capture_enabled" ||
    raw === "recovering" ||
    raw === "acknowledged"
  ) {
    return raw;
  }
  if (!device.last_traffic_at) return "unknown";
  if (device.monitoring_status === "offline") return "offline";
  if (device.monitoring_status === "under_attack") return "anomalous";
  if (device.monitoring_status === "suspicious") return "degraded";
  return "online";
}

function pulseSpeedForStatus(status: OperationalState): number {
  switch (status) {
    case "anomalous":
      return 0.8;
    case "degraded":
      return 1.2;
    case "recovering":
      return 1.0;
    case "acknowledged":
      return 0.0;
    case "online":
    case "capture_enabled":
      return 2;
    default:
      return 0;
  }
}

export function buildTopologyNodes(devices: DeviceResponse[]): Node<TopologyNodeData>[] {
  return devices.map((device, index) => {
    const col = index % GRID_COLS;
    const row = Math.floor(index / GRID_COLS);
    const status = mapOperationalState(device);
    return {
      id: String(device.id),
      type: "otDevice",
      position: {
        x: GRID_START_X + col * GRID_GAP_X,
        y: GRID_START_Y + row * GRID_GAP_Y
      },
      data: {
        deviceId: device.id,
        name: device.name,
        ip: device.ip_address ?? null,
        deviceType: device.device_type ?? null,
        protocol: readProtocol(device.metadata_json ?? {}),
        status,
        riskScore: device.last_ml_risk_score ?? null,
        lastTrafficAt: device.last_traffic_at ?? null,
        pulseSpeed: pulseSpeedForStatus(status)
      }
    };
  });
}

export function buildTopologyEdges(
  edges: TopologyEdgeRecord[],
  activity: Map<number, { active: boolean; packet_count: number }>,
  deviceIds: Set<number>
): Edge<TopologyEdgeData>[] {
  const validEdges: Edge<TopologyEdgeData>[] = [];
  let dropped = 0;

  edges.forEach((edge) => {
    if (!deviceIds.has(edge.source_device_id) || !deviceIds.has(edge.target_device_id)) {
      dropped += 1;
      return;
    }
    const act = activity.get(edge.id);
    const active = Boolean(act?.active ?? edge.is_active);
    const packetCount = act?.packet_count ?? edge.packet_count;
    validEdges.push({
      id: `e-${edge.id}`,
      type: "otTraffic",
      source: String(edge.source_device_id),
      target: String(edge.target_device_id),
      animated: active && packetCount > 0,
      data: {
        edgeId: edge.id,
        packetCount,
        protocolHint: edge.protocol_context,
        relationshipType: edge.relationship_type,
        direction: edge.direction,
        active,
        animated: active && packetCount > 0
      }
    });
  });

  if (dropped > 0) {
    console.warn(`[topology] Dropped ${dropped} invalid edges (missing source/target)`);
  }

  return validEdges;
}
