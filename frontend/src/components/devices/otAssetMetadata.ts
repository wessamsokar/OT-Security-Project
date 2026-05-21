import type { DeviceResponse } from "../../api/devicesApi";

import type { MonitoringStatusKey } from "./otAssetOptions";
import { MONITORING_STATUS_LABELS } from "./otAssetOptions";

/** Keys persisted in backend `metadata_json` for OT inventory context (never security verdicts). */
export const OT_META = {
  criticality: "criticality_level",
  description: "asset_description",
  macAddress: "mac_address",
  protocol: "protocol_type",
  port: "port_number",
  networkZone: "network_zone",
  trafficSource: "traffic_source_type",
  monitoringMode: "monitoring_mode",
  expectedRate: "expected_traffic_rate",
  packetCapture: "packet_capture_enabled",
  mlDetection: "ml_threat_detection",
  realtimeMonitoring: "realtime_monitoring",
  uiVersion: "ot_sentinel_ui_v"
} as const;

export type OtTrafficSourceFormValues = {
  name: string;
  customerId?: number;
  assetType: string;
  criticalityLevel: string;
  siteLocation: string;
  description: string;
  ipAddress: string;
  macAddress: string;
  protocolType: string;
  portNumber: string;
  networkZone: string;
  trafficSourceType: string;
  monitoringMode: string;
  expectedTrafficRate: string;
  packetCaptureEnabled: boolean;
  mlThreatDetection: boolean;
  realtimeMonitoring: boolean;
  advancedMetadataJson: string;
  isActive: boolean;
};

export function defaultOtTrafficSourceForm(): OtTrafficSourceFormValues {
  return {
    name: "",
    customerId: undefined,
    assetType: "PLC",
    criticalityLevel: "Medium",
    siteLocation: "",
    description: "",
    ipAddress: "",
    macAddress: "",
    protocolType: "Modbus_TCP",
    portNumber: "502",
    networkZone: "Field Network",
    trafficSourceType: "Live Traffic",
    monitoringMode: "Passive",
    expectedTrafficRate: "Low (< 100 pps baseline)",
    packetCaptureEnabled: false,
    mlThreatDetection: true,
    realtimeMonitoring: true,
    advancedMetadataJson: "",
    isActive: true
  };
}

function readMetaString(meta: Record<string, unknown>, key: string, fallback = "") {
  const v = meta[key];
  return typeof v === "string" ? v : fallback;
}

function readMetaBool(meta: Record<string, unknown>, key: string, fallback: boolean) {
  const v = meta[key];
  return typeof v === "boolean" ? v : fallback;
}

function readPort(meta: Record<string, unknown>, fallback: string) {
  const v = meta[OT_META.port];
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string") return v;
  return fallback;
}

export function stripKnownOtKeys(metadata: Record<string, unknown>): Record<string, unknown> {
  const keys = new Set([
    ...(Object.values(OT_META) as string[]),
    "ingestion_type",
    "monitoring_status",
    "risk_score_estimate",
    "ml_risk_score",
    "ml_status"
  ]);
  const clone: Record<string, unknown> = { ...metadata };
  keys.forEach((k) => delete clone[k]);
  return clone;
}

export function formValuesFromDevice(device: DeviceResponse): OtTrafficSourceFormValues {
  const meta =
    device.metadata_json && typeof device.metadata_json === "object" ? (device.metadata_json as Record<string, unknown>) : {};

  const base = defaultOtTrafficSourceForm();
  const leftovers = stripKnownOtKeys(meta);
  const advancedJson =
    leftovers && Object.keys(leftovers).length > 0 ? JSON.stringify(leftovers, null, 2) : "";

  return {
    ...base,
    name: device.name ?? "",
    customerId: device.user_id,
    assetType: device.device_type ?? "PLC",
    siteLocation: device.location ?? "",
    ipAddress: device.ip_address ?? "",
    macAddress: readMetaString(meta, OT_META.macAddress),
    description: readMetaString(meta, OT_META.description),
    criticalityLevel: readMetaString(meta, OT_META.criticality, "Medium") || "Medium",
    protocolType: readMetaString(meta, OT_META.protocol, "Modbus_TCP") || "Modbus_TCP",
    portNumber: readPort(meta, "502"),
    networkZone: readMetaString(meta, OT_META.networkZone, "Field Network") || "Field Network",
    trafficSourceType: readMetaString(meta, OT_META.trafficSource, "Live Traffic") || "Live Traffic",
    monitoringMode: readMetaString(meta, OT_META.monitoringMode, "Passive") || "Passive",
    expectedTrafficRate: readMetaString(meta, OT_META.expectedRate, base.expectedTrafficRate),
    packetCaptureEnabled: readMetaBool(meta, OT_META.packetCapture, false),
    mlThreatDetection: readMetaBool(meta, OT_META.mlDetection, true),
    realtimeMonitoring: readMetaBool(meta, OT_META.realtimeMonitoring, true),
    advancedMetadataJson: advancedJson,
    isActive: device.is_active
  };
}

export function buildMetadataPayload(
  form: OtTrafficSourceFormValues,
  options: {
    existingMetadata?: Record<string, unknown>;
    /** Unstructured keys merged under structured OT fields (structured wins on key collision). */
    extraAdvanced?: Record<string, unknown>;
  }
): Record<string, unknown> {
  const existingRaw = options.existingMetadata && typeof options.existingMetadata === "object" ? options.existingMetadata : {};
  const existing = existingRaw as Record<string, unknown>;

  const portTrim = form.portNumber.trim();
  let portValue: number | string = portTrim;
  const n = Number(portTrim);
  if (portTrim !== "" && Number.isFinite(n) && n >= 1 && n <= 65535) {
    portValue = n;
  }

  const structured: Record<string, unknown> = {
    [OT_META.uiVersion]: 1,
    [OT_META.criticality]: form.criticalityLevel,
    [OT_META.description]: form.description.trim(),
    [OT_META.macAddress]: form.macAddress.trim(),
    [OT_META.protocol]: form.protocolType,
    [OT_META.port]: portValue,
    [OT_META.networkZone]: form.networkZone,
    [OT_META.trafficSource]: form.trafficSourceType,
    [OT_META.monitoringMode]: form.monitoringMode,
    [OT_META.expectedRate]: form.expectedTrafficRate.trim(),
    [OT_META.packetCapture]: form.packetCaptureEnabled,
    [OT_META.mlDetection]: form.mlThreatDetection,
    [OT_META.realtimeMonitoring]: form.realtimeMonitoring,
    ingestion_type: "ot_traffic_source"
  };

  const advancedParsed = options.extraAdvanced && typeof options.extraAdvanced === "object" ? options.extraAdvanced : {};

  return { ...advancedParsed, ...structured };
}

/** Returns empty object for blank input; throws if non-blank but invalid. */
export function parseAdvancedMetadataJson(raw: string): Record<string, unknown> {
  const t = raw.trim();
  if (!t) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(t);
  } catch {
    throw new Error("Advanced metadata must be valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Advanced metadata must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

const SERVER_MONITORING_KEYS: MonitoringStatusKey[] = ["active", "offline", "suspicious", "under_attack"];

export function resolveMonitoringBadge(device: DeviceResponse): {
  label: string;
  className: string;
  key: MonitoringStatusKey | "inactive";
} {
  const raw = (device.monitoring_status || "offline").toLowerCase();
  const key =
    SERVER_MONITORING_KEYS.includes(raw as MonitoringStatusKey) ? (raw as MonitoringStatusKey) : "offline";

  if (!device.is_active) {
    return {
      label: "Inventory inactive",
      className: "border-white/12 bg-white/6 text-muted",
      key: "inactive"
    };
  }

  if (key === "active") {
    return {
      label: MONITORING_STATUS_LABELS.active,
      className: "border-emerald-500/35 bg-emerald-500/15 text-emerald-100",
      key: "active"
    };
  }
  if (key === "offline") {
    return {
      label: MONITORING_STATUS_LABELS.offline,
      className: "border-white/15 bg-white/8 text-muted",
      key: "offline"
    };
  }
  if (key === "suspicious") {
    return {
      label: MONITORING_STATUS_LABELS.suspicious,
      className: "border-violet-500/35 bg-violet-500/15 text-violet-100",
      key: "suspicious"
    };
  }
  return {
    label: MONITORING_STATUS_LABELS.under_attack,
    className:
      "border-rose-500/40 bg-rose-500/15 text-rose-100 shadow-[0_0_16px_rgba(244,63,94,0.25)] animate-pulse",
    key: "under_attack"
  };
}

/** Server-derived operational_state for topology + inventory (Phase 2). */
export function resolveOperationalBadge(device: DeviceResponse): {
  label: string;
  className: string;
} {
  const state = (device.operational_state || "unknown").toLowerCase();
  switch (state) {
    case "online":
      return { label: "Online", className: "border-emerald-500/35 bg-emerald-500/15 text-emerald-100" };
    case "offline":
      return { label: "Offline", className: "border-white/15 bg-white/8 text-muted" };
    case "inactive":
      return { label: "Inactive", className: "border-white/12 bg-white/6 text-muted" };
    case "anomalous":
      return {
        label: "Anomalous",
        className: "border-rose-500/40 bg-rose-500/15 text-rose-100 animate-pulse"
      };
    case "degraded":
      return { label: "Degraded", className: "border-amber-500/35 bg-amber-500/15 text-amber-100" };
    case "recovering":
      return { label: "Recovering", className: "border-teal-500/40 bg-teal-500/15 text-teal-100 animate-pulse" };
    case "capture_enabled":
      return { label: "Capture on", className: "border-violet-500/35 bg-violet-500/15 text-violet-100" };
    case "unknown":
    default:
      return { label: "No traffic", className: "border-slate-500/30 bg-slate-500/10 text-slate-300" };
  }
}
