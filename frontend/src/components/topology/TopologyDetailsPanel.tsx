import { memo } from "react";

import type { DeviceResponse } from "../../api/devicesApi";
import { OT_META } from "../devices/otAssetMetadata";

type Props = {
  device: DeviceResponse | null;
};

function readMetaString(meta: Record<string, unknown>, key: string): string | null {
  const v = meta[key];
  return typeof v === "string" && v.trim() ? v : null;
}

export const TopologyDetailsPanel = memo(({ device }: Props) => {
  if (!device) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
        Select a device node to view live telemetry details.
      </div>
    );
  }

  const meta = device.metadata_json ?? {};
  const protocol = readMetaString(meta, OT_META.protocol);
  const vendor = readMetaString(meta, "vendor") ?? "—";
  const zone = readMetaString(meta, OT_META.networkZone) ?? "—";
  const trafficSource = readMetaString(meta, OT_META.trafficSource) ?? "—";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-brand">Device details</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{device.name}</h3>
          <p className="mt-1 text-xs text-muted">{device.ip_address ?? "No IP"}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-muted">
            {device.monitoring_status}
          </span>
          {device.tenant_name ? (
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-muted">
              {device.tenant_name}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-white/10 bg-background/40 p-3">
          <p className="text-[10px] text-muted">Protocol</p>
          <p className="mt-1 text-white">{protocol?.replace(/_/g, " ") ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-background/40 p-3">
          <p className="text-[10px] text-muted">Device type</p>
          <p className="mt-1 text-white">{device.device_type ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-background/40 p-3">
          <p className="text-[10px] text-muted">Network zone</p>
          <p className="mt-1 text-white">{zone}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-background/40 p-3">
          <p className="text-[10px] text-muted">Traffic source</p>
          <p className="mt-1 text-white">{trafficSource}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-background/40 p-3">
          <p className="text-[10px] text-muted">Vendor</p>
          <p className="mt-1 text-white">{vendor}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-background/40 p-3">
          <p className="text-[10px] text-muted">Last traffic</p>
          <p className="mt-1 text-white">
            {device.last_traffic_at ? new Date(device.last_traffic_at).toLocaleString() : "No telemetry"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-white/10 bg-background/40 p-3">
          <p className="text-[10px] text-muted">ML status</p>
          <p className="mt-1 text-white">{device.last_ml_status ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-background/40 p-3">
          <p className="text-[10px] text-muted">ML risk</p>
          <p className="mt-1 text-white">
            {device.last_ml_risk_score != null ? `${Math.round(device.last_ml_risk_score * 100)}%` : "—"}
          </p>
        </div>
      </div>
    </div>
  );
});

TopologyDetailsPanel.displayName = "TopologyDetailsPanel";
