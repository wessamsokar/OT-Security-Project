import { memo } from "react";
import type { NodeProps } from "reactflow";

import type { TopologyNodeData } from "./topologyAdapter";

function statusStyles(status: TopologyNodeData["status"], selected: boolean) {
  const base = selected ? "ring-2 ring-brand/70 " : "";
  switch (status) {
    case "online":
      return `${base}border-emerald-400/70 shadow-[0_0_22px_rgba(16,185,129,0.45)]`;
    case "capture_enabled":
      return `${base}border-violet-400/70 shadow-[0_0_22px_rgba(139,92,246,0.45)]`;
    case "offline":
    case "inactive":
      return `${base}border-rose-400/50 opacity-55`;
    case "anomalous":
      return `${base}border-red-500/80 shadow-[0_0_24px_rgba(239,68,68,0.55)]`;
    case "degraded":
      return `${base}border-amber-400/70 shadow-[0_0_20px_rgba(245,158,11,0.4)]`;
    case "unknown":
    default:
      return `${base}border-slate-400/45 opacity-75`;
  }
}

function statusDot(status: TopologyNodeData["status"]) {
  switch (status) {
    case "online":
      return "bg-emerald-400";
    case "capture_enabled":
      return "bg-violet-400";
    case "offline":
    case "inactive":
      return "bg-rose-400";
    case "anomalous":
      return "bg-red-500 animate-pulse";
    case "degraded":
      return "bg-amber-400";
    default:
      return "bg-slate-400";
  }
}

function statusLabel(status: TopologyNodeData["status"]) {
  return status.replace(/_/g, " ");
}

export const TopologyNode = memo(({ data, selected }: NodeProps<TopologyNodeData>) => {
  const pulseStyle =
    data.pulseSpeed > 0
      ? ({ animationDuration: `${Math.max(0.6, 2.4 / data.pulseSpeed)}s` } as const)
      : undefined;

  return (
    <div className={data.pulseSpeed > 0 ? "topology-node-pulse" : undefined} style={pulseStyle}>
      <div
        className={[
          "min-w-[168px] rounded-2xl border bg-[#0b1329]/92 px-3 py-2 text-[11px] text-slate-200",
          "shadow-[0_0_30px_rgba(99,102,241,0.12)] backdrop-blur",
          statusStyles(data.status, selected)
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-white truncate">{data.name}</div>
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusDot(data.status)}`} title={statusLabel(data.status)} />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
          <span>{data.deviceType ?? "Unknown"}</span>
          <span className="uppercase tracking-wide text-[9px] text-slate-500">{statusLabel(data.status)}</span>
        </div>
        <div className="mt-1 text-[10px] text-slate-400 truncate">{data.ip ?? "No IP"}</div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
          <span>Risk {data.riskScore != null ? `${Math.round(data.riskScore * 100)}%` : "—"}</span>
          <span>{data.protocol?.replace(/_/g, " ") ?? "—"}</span>
        </div>
      </div>
    </div>
  );
});

TopologyNode.displayName = "TopologyNode";
