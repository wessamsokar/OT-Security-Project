import { memo } from "react";
import type { EdgeProps } from "reactflow";
import { BaseEdge, getBezierPath } from "reactflow";

import type { TopologyEdgeData } from "./topologyAdapter";

export const TopologyEdge = memo(
  ({ id, data, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps<TopologyEdgeData>) => {
    const isActive = Boolean(data?.active);
    const hasTraffic = Boolean(data && data.packetCount > 0);
    const isAnimated = isActive && hasTraffic;
    
    const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

    let baseColor = "#38bdf8"; // sky-400
    if (isActive) {
      switch (data?.relationshipType) {
        case "peer":
          baseColor = "#c084fc"; // purple-400
          break;
        case "parent":
          baseColor = "#fbbf24"; // amber-400
          break;
        case "upstream":
          baseColor = "#f87171"; // red-400
          break;
        case "downstream":
          baseColor = "#34d399"; // emerald-400
          break;
        case "connected_to":
        default:
          baseColor = "#38bdf8"; // sky-400
          break;
      }
    } else {
      baseColor = "#475569"; // slate-600
    }

    const width = isAnimated ? Math.min(3.2, 1.2 + Math.log10(Math.max(10, data?.packetCount ?? 10)) * 0.5) : 1.5;
    
    const opacity = isActive ? (hasTraffic ? 0.95 : 0.7) : 0.35;
    const isDashed = !isActive;

    return (
      <g className="topology-edge-group">
        <title>{data?.relationshipType || "unknown"}</title>
        {isAnimated ? (
          <path
            d={edgePath}
            fill="none"
            stroke={baseColor}
            strokeOpacity={0.55}
            strokeWidth={width + 4}
            strokeLinecap="round"
            className="topology-edge-glow"
          />
        ) : null}
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            stroke: baseColor,
            strokeWidth: width,
            opacity,
            strokeDasharray: isDashed ? "6 8" : undefined
          }}
        />
        {isAnimated ? (
          <circle r="3" fill="#ffffff" stroke={baseColor} strokeWidth={1} className="topology-edge-packet">
            <animateMotion dur="1.8s" repeatCount="indefinite" path={edgePath} />
          </circle>
        ) : null}
      </g>
    );
  }
);

TopologyEdge.displayName = "TopologyEdge";
