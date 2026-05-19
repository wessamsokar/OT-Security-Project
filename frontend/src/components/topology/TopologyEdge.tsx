import { memo } from "react";
import type { EdgeProps } from "reactflow";
import { BaseEdge, getBezierPath } from "reactflow";

import type { TopologyEdgeData } from "./topologyAdapter";

export const TopologyEdge = memo(
  ({ id, data, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps<TopologyEdgeData>) => {
    const active = Boolean(data?.active && data.packetCount > 0);
    const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

    const stroke = active ? "#38bdf8" : "#475569";
    const glow = active ? "rgba(56, 189, 248, 0.55)" : "transparent";
    const width = active ? Math.min(3.2, 1.2 + Math.log10(Math.max(10, data?.packetCount ?? 10)) * 0.5) : 1.2;

    return (
      <>
        {active ? (
          <path
            d={edgePath}
            fill="none"
            stroke={glow}
            strokeWidth={width + 4}
            strokeLinecap="round"
            className="topology-edge-glow"
          />
        ) : null}
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            stroke,
            strokeWidth: width,
            opacity: active ? 0.95 : 0.35,
            strokeDasharray: active ? undefined : "6 8"
          }}
        />
        {active ? (
          <circle r="3" fill="#7dd3fc" className="topology-edge-packet">
            <animateMotion dur="1.8s" repeatCount="indefinite" path={edgePath} />
          </circle>
        ) : null}
      </>
    );
  }
);

TopologyEdge.displayName = "TopologyEdge";
