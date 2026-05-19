import { memo, useMemo } from "react";
import ReactFlow, { Background, Controls, MiniMap, type Node, type Edge } from "reactflow";
import "reactflow/dist/style.css";

import { TopologyEdge } from "./TopologyEdge";
import { TopologyNode } from "./TopologyNode";
import type { TopologyEdgeData, TopologyNodeData } from "./topologyAdapter";

const nodeTypes = { otDevice: TopologyNode };
const edgeTypes = { otTraffic: TopologyEdge };

type Props = {
  nodes: Node<TopologyNodeData>[];
  edges: Edge<TopologyEdgeData>[];
  onSelectNode: (deviceId: number | null) => void;
};

export const TopologyGraph = memo(({ nodes, edges, onSelectNode }: Props) => {
  const minZoom = 0.4;
  const maxZoom = 1.4;
  const fitViewOptions = useMemo(() => ({ padding: 0.18, minZoom, maxZoom }), [minZoom, maxZoom]);

  return (
    <div className="h-[520px] w-full rounded-2xl border border-white/10 bg-[#081024]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, node) => onSelectNode(Number(node.id))}
        onPaneClick={() => onSelectNode(null)}
        fitView
        fitViewOptions={fitViewOptions}
        minZoom={minZoom}
        maxZoom={maxZoom}
        panOnScroll
        zoomOnScroll
      >
        <Background color="#1e293b" gap={24} size={1} />
        <MiniMap
          nodeColor={(node) => {
            const status = (node.data as TopologyNodeData | undefined)?.status;
            if (status === "online" || status === "capture_enabled") return "#34d399";
            if (status === "degraded") return "#f59e0b";
            if (status === "anomalous" || status === "offline") return "#f87171";
            return "#94a3b8";
          }}
          maskColor="rgba(6, 15, 30, 0.6)"
          className="rounded-xl border border-white/10"
        />
        <Controls className="!border-white/10 !bg-[#0b1329]/80" />
      </ReactFlow>
    </div>
  );
});

TopologyGraph.displayName = "TopologyGraph";
