import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useReducer, useRef } from "react";

import type { DeviceResponse } from "../../api/devicesApi";
import type { TopologyEdgeActivity, TopologyEdgeRecord, TopologyNodeSnapshot } from "../../api/topologyApi";

export type OperationalState =
  | "online"
  | "offline"
  | "unknown"
  | "inactive"
  | "anomalous"
  | "degraded"
  | "capture_enabled";

export type TopologyState = {
  devices: DeviceResponse[];
  edges: TopologyEdgeRecord[];
  edgeActivity: Map<number, TopologyEdgeActivity>;
  selectedDeviceId: number | null;
  lastSeq: number;
  liveConnected: boolean;
};

type TopologyAction =
  | {
      type: "applySnapshot";
      nodes: TopologyNodeSnapshot[];
      edges: TopologyEdgeRecord[];
      edgeActivity: TopologyEdgeActivity[];
      seq?: number;
    }
  | { type: "selectDevice"; deviceId: number | null }
  | { type: "setLiveConnected"; connected: boolean };

function nodeToDevice(node: TopologyNodeSnapshot): DeviceResponse {
  return {
    id: node.device_id,
    user_id: 0,
    name: node.name,
    device_type: node.device_type,
    ip_address: node.ip_address,
    serial_number: null,
    location: null,
    metadata_json: node.metadata_json ?? {},
    is_active: node.is_active,
    created_at: "",
    updated_at: "",
    last_ml_risk_score: node.last_ml_risk_score,
    last_ml_status: node.last_ml_status,
    monitoring_status: node.monitoring_status,
    operational_state: node.operational_state,
    last_traffic_at: node.last_traffic_at,
    last_seen_traffic_id: null
  };
}

function reducer(state: TopologyState, action: TopologyAction): TopologyState {
  switch (action.type) {
    case "applySnapshot": {
      if (action.seq != null && action.seq <= state.lastSeq) {
        return state;
      }
      const activityMap = new Map<number, TopologyEdgeActivity>();
      action.edgeActivity.forEach((item) => activityMap.set(item.edge_id, item));
      return {
        ...state,
        devices: action.nodes.map(nodeToDevice),
        edges: action.edges,
        edgeActivity: activityMap,
        lastSeq: action.seq ?? state.lastSeq + 1
      };
    }
    case "selectDevice":
      return { ...state, selectedDeviceId: action.deviceId };
    case "setLiveConnected":
      return { ...state, liveConnected: action.connected };
    default:
      return state;
  }
}

const initialState: TopologyState = {
  devices: [],
  edges: [],
  edgeActivity: new Map(),
  selectedDeviceId: null,
  lastSeq: 0,
  liveConnected: false
};

type TopologyContextValue = TopologyState & {
  applySnapshot: (payload: {
    nodes: TopologyNodeSnapshot[];
    edges: TopologyEdgeRecord[];
    edge_activity: TopologyEdgeActivity[];
    seq?: number;
  }) => void;
  selectDevice: (deviceId: number | null) => void;
  setLiveConnected: (connected: boolean) => void;
};

const TopologyContext = createContext<TopologyContextValue | undefined>(undefined);

export function TopologyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const throttleRef = useRef<number | null>(null);
  const pendingRef = useRef<Parameters<TopologyContextValue["applySnapshot"]>[0] | null>(null);

  const applySnapshot = useCallback((payload: Parameters<TopologyContextValue["applySnapshot"]>[0]) => {
    pendingRef.current = payload;
    if (throttleRef.current != null) return;

    throttleRef.current = window.setTimeout(() => {
      throttleRef.current = null;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (!pending) return;
      dispatch({
        type: "applySnapshot",
        nodes: pending.nodes,
        edges: pending.edges,
        edgeActivity: pending.edge_activity,
        seq: pending.seq
      });
    }, 400);
  }, []);

  const value = useMemo<TopologyContextValue>(
    () => ({
      ...state,
      applySnapshot,
      selectDevice: (deviceId) => dispatch({ type: "selectDevice", deviceId }),
      setLiveConnected: (connected) => dispatch({ type: "setLiveConnected", connected })
    }),
    [state, applySnapshot]
  );

  return <TopologyContext.Provider value={value}>{children}</TopologyContext.Provider>;
}

export function useTopologyStore(): TopologyContextValue {
  const context = useContext(TopologyContext);
  if (!context) {
    throw new Error("useTopologyStore must be used within TopologyProvider");
  }
  return context;
}
