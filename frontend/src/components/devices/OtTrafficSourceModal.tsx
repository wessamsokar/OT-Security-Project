import type { LucideIcon } from "lucide-react";
import { ChevronDown, Cpu, Radar, Shield, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "../ui/Button";
import { InputField } from "../ui/InputField";
import { RelationshipPanel } from "./RelationshipPanel";
import type { RelationshipPanelRef } from "./RelationshipPanel";

import {
  ASSET_TYPE_OPTIONS,
  CRITICALITY_OPTIONS,
  MONITORING_MODE_OPTIONS,
  NETWORK_ZONE_OPTIONS,
  PROTOCOL_OPTIONS,
  TRAFFIC_SOURCE_OPTIONS
} from "./otAssetOptions";
import type { OtTrafficSourceFormValues } from "./otAssetMetadata";
import type { DeviceResponse } from "../../api/devicesApi";
import { useAuth } from "../../contexts/AuthContext";
import { useTenant } from "../../contexts/TenantContext";

const SELECT_ROW =
  "w-full rounded-xl border border-white/15 bg-[#0c152d]/80 px-2.5 py-2 text-sm text-text outline-none transition focus:border-brand/70 focus:ring-2 focus:ring-brand/20";

function SectionHeader({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand shadow-[0_0_16px_rgba(168,85,247,0.2)]">
        <Icon size={18} strokeWidth={1.75} />
      </div>
      <div>
        <h3 className="text-sm font-semibold tracking-wide text-white">{title}</h3>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function SoftToggle({
  id,
  label,
  hint,
  checked,
  onChange
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-muted"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-text">{label}</span>
        <span className="block text-[11px] text-muted">{hint}</span>
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-white/25 bg-[#0c152d]/80 accent-brand"
      />
    </label>
  );
}

function GlowToggle({
  id,
  label,
  description,
  checked,
  onChange
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition hover:border-brand/25 hover:bg-brand/5"
    >
      <span className="min-w-0 pr-2">
        <span className="block text-sm font-medium text-text">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-muted">{description}</span>
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-white/25 bg-[#0c152d]/80 accent-brand text-brand"
      />
    </label>
  );
}

export type DeviceMlSnapshot = {
  id: number;
  last_ml_risk_score: number | null;
  last_ml_status: string | null;
  last_attack_at: string | null;
  last_recovered_at: string | null;
  attack_acknowledged_at: string | null;
  attack_resolved_at: string | null;
  monitoring_status: string | null;
  operational_state: string | null;
};

function formatMlStatusLabel(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "—";
  return raw.replace(/_/g, " ");
}

type Props = {
  open: boolean;
  isEditing: boolean;
  /** Latest server-side ML aggregates for this inventory row (edit only). */
  mlSnapshot?: DeviceMlSnapshot;
  existingDevices: DeviceResponse[];
  editingId?: number | null;
  form: OtTrafficSourceFormValues;
  setForm: React.Dispatch<React.SetStateAction<OtTrafficSourceFormValues>>;
  saving: boolean;
  formError: string;
  onSubmit: () => void;
  onClose: () => void;
  /** Called whenever edge mutations occur, so the parent can refresh the topology store. */
  onEdgesChanged?: () => void;
  /** Exposes the RelationshipPanel imperative ref to the parent (needed for create-mode flush). */
  onPanelRef?: (ref: RelationshipPanelRef) => void;
  /** Called when user clicks "Clear Attack" to reset operational state. */
  onClearAttack?: (id: number) => void;
  /** Called when user clicks "Acknowledge" to mark the alert as seen. */
  onAcknowledgeAttack?: (id: number) => void;
};

export function OtTrafficSourceModal({
  open,
  isEditing,
  mlSnapshot,
  existingDevices,
  editingId,
  form,
  setForm,
  saving,
  formError,
  onSubmit,
  onClose,
  onEdgesChanged,
  onPanelRef,
  onClearAttack,
  onAcknowledgeAttack
}: Props) {
  const { hasPermission } = useAuth();
  const { assignedCustomers } = useTenant();
  const isAdmin = hasPermission("manage_users");
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const protocolTouchedRef = useRef(false);
  const monitoringModeTouchedRef = useRef(false);
  useEffect(() => {
    if (open) {
      setShowAdvanced(false);
      protocolTouchedRef.current = false;
      monitoringModeTouchedRef.current = false;
    }
  }, [open]);

  const inferProtocolFromPort = (port: string): string | null => {
    const trimmed = port.trim();
    if (!trimmed) return null;
    const hit = PROTOCOL_OPTIONS.find((p) => p.defaultPort === trimmed);
    return hit?.value ?? null;
  };

  const resolveMonitoringMode = (assetType: string) => {
    const passiveTypes = new Set(["PLC", "RTU", "HMI", "SCADA_Server", "Historian", "Sensor"]);
    if (passiveTypes.has(assetType)) return "Passive";
    return "Active";
  };

  const protocolLabel =
    PROTOCOL_OPTIONS.find((p) => p.value === form.protocolType)?.label.replace("/", " / ") ?? form.protocolType;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-[2px] md:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[min(92vh,56rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-b from-[#0d1732]/98 to-[#0a1228]/98 shadow-[0_0_40px_rgba(88,28,135,0.12)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ot-register-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative border-b border-white/10 bg-[#0d1732]/80 px-5 py-4 md:px-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent opacity-80" />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-brand">
                <Sparkles size={14} className="text-brand drop-shadow-[0_0_10px_rgba(168,85,247,0.85)]" />
                Quick add device
              </div>
              <h2 id="ot-register-title" className="mt-1.5 text-lg font-semibold text-white md:text-xl">
                {isEditing ? "Edit OT device" : "Register OT device"}
              </h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted md:text-sm">
                Add a device in seconds. Advanced tuning stays optional until you need it.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand">
                <Radar size={13} />
                {protocolLabel}
              </span>
              {isEditing && mlSnapshot?.last_ml_status ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-muted">
                  ML: {formatMlStatusLabel(mlSnapshot.last_ml_status)}
                </span>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5 [scrollbar-gutter:stable]">
          <div className="space-y-4">
            {isAdmin ? (
              <div className="space-y-4 rounded-2xl border border-brand/20 bg-brand/5 p-4 shadow-inner shadow-black/20">
                <SectionHeader icon={Shield} title="Customer Environment" subtitle="Admin requirement: Assign to a customer." />
                <div>
                  <label htmlFor="ot-customer" className="block min-w-0">
                    <span className="mb-1 block text-xs text-brand sm:text-sm">Customer *</span>
                    <select
                      id="ot-customer"
                      className={`${SELECT_ROW} border-brand/30`}
                      value={form.customerId ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value ? Number(e.target.value) : undefined }))}
                    >
                      <option value="">Select a customer...</option>
                      {assignedCustomers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.company_name || c.username}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : null}

            <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0c152d]/35 p-4 shadow-inner shadow-black/20">
              <SectionHeader icon={Cpu} title="Quick add device" subtitle="Required fields only." />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2 lg:col-span-2">
                  <InputField
                    compact
                    id="ot-asset-name"
                    label="Device name *"
                    placeholder="PLC-Substation-01"
                    value={form.name}
                    onChange={(value) => setForm((p) => ({ ...p, name: value }))}
                  />
                </div>
                <div>
                  <label htmlFor="ot-asset-type" className="block min-w-0">
                    <span className="mb-1 block text-xs text-muted sm:text-sm">Device type *</span>
                    <select
                      id="ot-asset-type"
                      className={SELECT_ROW}
                      value={form.assetType}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        setForm((p) => ({
                          ...p,
                          assetType: nextType,
                          monitoringMode: monitoringModeTouchedRef.current
                            ? p.monitoringMode
                            : resolveMonitoringMode(nextType)
                        }));
                      }}
                    >
                      {ASSET_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div>
                  <label htmlFor="ot-protocol" className="block">
                    <span className="mb-1 block text-xs text-muted sm:text-sm">Protocol *</span>
                    <select
                      id="ot-protocol"
                      className={SELECT_ROW}
                      value={form.protocolType}
                      onChange={(e) => {
                        const next = e.target.value;
                        const def = PROTOCOL_OPTIONS.find((p) => p.value === next)?.defaultPort;
                        protocolTouchedRef.current = true;
                        setForm((p) => ({
                          ...p,
                          protocolType: next,
                          portNumber:
                            typeof def === "string" && def !== "" ? def : next === "Custom" ? "" : p.portNumber
                        }));
                      }}
                    >
                      {PROTOCOL_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <InputField
                    compact
                    id="ot-ip"
                    label="IP address *"
                    placeholder="10.0.1.12"
                    value={form.ipAddress}
                    onChange={(value) => setForm((p) => ({ ...p, ipAddress: value }))}
                  />
                </div>
                <div>
                  <InputField
                    compact
                    id="ot-site-loc"
                    label="Site / zone (optional)"
                    placeholder="Substation North"
                    value={form.siteLocation}
                    onChange={(value) => setForm((p) => ({ ...p, siteLocation: value }))}
                  />
                </div>
                <div>
                  <label htmlFor="ot-zone" className="block min-w-0">
                    <span className="mb-1 block text-xs text-muted sm:text-sm">Network zone (optional)</span>
                    <select
                      id="ot-zone"
                      className={SELECT_ROW}
                      value={form.networkZone}
                      onChange={(e) => setForm((p) => ({ ...p, networkZone: e.target.value }))}
                    >
                      {NETWORK_ZONE_OPTIONS.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className="pt-1">
                <SoftToggle
                  id="ot-pcap"
                  label="Packet capture"
                  hint="Keep PCAP capture available for investigations (SOC policy dependent)."
                  checked={form.packetCaptureEnabled}
                  onChange={(v) => setForm((p) => ({ ...p, packetCaptureEnabled: v }))}
                />
              </div>
            </div>

            <RelationshipPanel
              deviceId={editingId ?? null}
              existingDevices={existingDevices}
              onEdgesChanged={onEdgesChanged}
              onPanelRef={onPanelRef}
            />

            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02]">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-text transition hover:bg-white/5"
                onClick={() => setShowAdvanced((s) => !s)}
                aria-expanded={showAdvanced}
              >
                <ChevronDown
                  size={18}
                  className={[showAdvanced ? "rotate-180" : "", "shrink-0 text-muted transition-transform"].join(" ")}
                />
                <span className="min-w-0 flex-1">
                  Advanced metadata{" "}
                  <span className="block font-normal text-xs text-muted sm:inline sm:font-normal">
                    (optional JSON for integrations &amp; collectors)
                  </span>
                </span>
              </button>
              {showAdvanced ? (
                <div className="border-t border-white/10 px-4 pb-4 pt-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0c152d]/35 p-4">
                      <SectionHeader icon={Radar} title="Network & telemetry" subtitle="Optional tuning and capture details." />
                      <InputField
                        compact
                        id="ot-mac"
                        label="MAC address"
                        placeholder="00:1A:2B:3C:4D:5E"
                        value={form.macAddress}
                        onChange={(value) => setForm((p) => ({ ...p, macAddress: value }))}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <InputField
                          compact
                          id="ot-port"
                          label="Port"
                          placeholder="502"
                          value={form.portNumber}
                          onChange={(value) => {
                            const inferred = protocolTouchedRef.current ? null : inferProtocolFromPort(value);
                            setForm((p) => ({
                              ...p,
                              portNumber: value,
                              protocolType: inferred ?? p.protocolType
                            }));
                          }}
                        />
                        <label htmlFor="ot-source-type" className="block">
                          <span className="mb-1 block text-xs text-muted sm:text-sm">Traffic source</span>
                          <select
                            id="ot-source-type"
                            className={SELECT_ROW}
                            value={form.trafficSourceType}
                            onChange={(e) => setForm((p) => ({ ...p, trafficSourceType: e.target.value }))}
                          >
                            {TRAFFIC_SOURCE_OPTIONS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label htmlFor="ot-mon-mode" className="block">
                          <span className="mb-1 block text-xs text-muted sm:text-sm">Monitoring mode</span>
                          <select
                            id="ot-mon-mode"
                            className={SELECT_ROW}
                            value={form.monitoringMode}
                            onChange={(e) => {
                              monitoringModeTouchedRef.current = true;
                              setForm((p) => ({ ...p, monitoringMode: e.target.value }));
                            }}
                          >
                            {MONITORING_MODE_OPTIONS.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </label>
                        <InputField
                          compact
                          id="ot-rate"
                          label="Expected traffic rate"
                          placeholder="Low (< 100 pps baseline)"
                          value={form.expectedTrafficRate}
                          onChange={(value) => setForm((p) => ({ ...p, expectedTrafficRate: value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0c152d]/35 p-4">
                      <SectionHeader icon={Shield} title="Security & status" subtitle="Defaults are safe for onboarding." />
                      <div className="grid gap-2">
                        <GlowToggle
                          id="ot-ml"
                          label="ML threat detection"
                          description="Enabled by default for this asset."
                          checked={form.mlThreatDetection}
                          onChange={(v) => setForm((p) => ({ ...p, mlThreatDetection: v }))}
                        />
                        <GlowToggle
                          id="ot-rt"
                          label="Real-time monitoring"
                          description="Enabled by default for alerting and timelines."
                          checked={form.realtimeMonitoring}
                          onChange={(v) => setForm((p) => ({ ...p, realtimeMonitoring: v }))}
                        />
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/12 bg-white/[0.02] px-3 py-2 text-xs text-muted">
                          <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                            className="h-4 w-4 shrink-0 rounded border-white/20 bg-[#0c152d]/80 text-brand accent-brand"
                          />
                          <span className="leading-snug">
                            Mark device operational in inventory. Monitoring status updates automatically from traffic.
                          </span>
                        </label>
                      </div>
                      {isEditing ? (
                        <div className="rounded-xl border border-white/12 bg-white/[0.03] px-3 py-3 text-[11px] text-muted">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-medium text-white">Operational Timeline</p>
                            <div className="flex gap-2">
                              {mlSnapshot && mlSnapshot.monitoring_status && ["under_attack", "suspicious"].includes(mlSnapshot.monitoring_status) && !mlSnapshot.attack_acknowledged_at ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 border-amber-500/50 px-2 py-0 text-[10px] text-amber-200 hover:bg-amber-500/20"
                                  onClick={() => {
                                    if (onAcknowledgeAttack && mlSnapshot.id) onAcknowledgeAttack(mlSnapshot.id);
                                  }}
                                >
                                  Acknowledge
                                </Button>
                              ) : null}
                              {mlSnapshot && mlSnapshot.monitoring_status && ["under_attack", "suspicious", "active"].includes(mlSnapshot.monitoring_status) && mlSnapshot.operational_state !== "online" ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 border-rose-500/50 px-2 py-0 text-[10px] text-rose-200 hover:bg-rose-500/20"
                                  onClick={() => {
                                    if (onClearAttack && mlSnapshot.id) onClearAttack(mlSnapshot.id);
                                  }}
                                >
                                  Resolve
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          {mlSnapshot && (mlSnapshot.last_ml_risk_score != null || mlSnapshot.last_ml_status) ? (
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-wrap items-end justify-between gap-3">
                                <div>
                                  <p className="text-[10px] uppercase tracking-wide text-muted">Risk</p>
                                  <p className="text-lg font-semibold text-brand">
                                    {mlSnapshot.last_ml_risk_score != null
                                      ? `${(mlSnapshot.last_ml_risk_score * 100).toFixed(1)}%`
                                      : "—"}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] uppercase tracking-wide text-muted">Status</p>
                                  <p className="font-medium capitalize text-text">
                                    {formatMlStatusLabel(mlSnapshot.last_ml_status)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 border-t border-white/10 pt-2 text-[10px]">
                                {mlSnapshot.last_attack_at && (
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span><span className="text-muted">Attack detected</span></div>
                                    <span className="text-rose-300">
                                      {new Date(mlSnapshot.last_attack_at).toLocaleString()}
                                    </span>
                                  </div>
                                )}
                                {mlSnapshot.attack_acknowledged_at && (
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span><span className="text-muted">Acknowledged</span></div>
                                    <span className="text-amber-300">
                                      {new Date(mlSnapshot.attack_acknowledged_at).toLocaleString()}
                                    </span>
                                  </div>
                                )}
                                {mlSnapshot.last_recovered_at && mlSnapshot.operational_state === "recovering" && (
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse"></span><span className="text-muted">Recovering (cooldown)</span></div>
                                    <span className="text-teal-300">
                                      {new Date(mlSnapshot.last_recovered_at).toLocaleString()}
                                    </span>
                                  </div>
                                )}
                                {mlSnapshot.attack_resolved_at && (
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span><span className="text-muted">Resolved</span></div>
                                    <span className="text-emerald-300">
                                      {new Date(mlSnapshot.attack_resolved_at).toLocaleString()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p>ML signals appear after traffic is observed.</p>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0c152d]/35 p-4">
                      <SectionHeader icon={Cpu} title="Asset context" subtitle="Optional device context." />
                      <div className="grid gap-3">
                        <label htmlFor="ot-criticality" className="block min-w-0">
                          <span className="mb-1 block text-xs text-muted sm:text-sm">Criticality</span>
                          <select
                            id="ot-criticality"
                            className={SELECT_ROW}
                            value={form.criticalityLevel}
                            onChange={(e) => setForm((p) => ({ ...p, criticalityLevel: e.target.value }))}
                          >
                            {CRITICALITY_OPTIONS.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label htmlFor="ot-desc" className="block">
                          <span className="mb-1 block text-xs text-muted sm:text-sm">Device notes</span>
                          <textarea
                            id="ot-desc"
                            rows={2}
                            placeholder="Optional device context for analysts"
                            value={form.description}
                            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                            className="min-h-[3rem] w-full resize-y rounded-xl border border-white/15 bg-[#0c152d]/80 px-2.5 py-2 text-sm leading-snug text-text outline-none transition placeholder:text-muted/70 focus:border-brand/70 focus:ring-2 focus:ring-brand/20"
                          />
                        </label>
                      </div>
                    </div>

                    {topologyDevices.length > 0 ? (
                      <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0c152d]/35 p-4">
                        <SectionHeader icon={Radar} title="Topology" subtitle="Optional relationships (visible when inventory exists)." />
                        <div className="grid gap-2">
                          <label htmlFor="ot-connected" className="block">
                            <span className="mb-1 block text-xs text-muted sm:text-sm">Connected to</span>
                            <select
                              id="ot-connected"
                              className={SELECT_ROW}
                              value={form.connectedToDeviceId}
                              onChange={(e) => setForm((p) => ({ ...p, connectedToDeviceId: e.target.value }))}
                            >
                              <option value="">None</option>
                              {topologyDevices.map((device) => (
                                <option key={device.id} value={String(device.id)}>
                                  {device.name} {device.ip_address ? `(${device.ip_address})` : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label htmlFor="ot-parent" className="block">
                            <span className="mb-1 block text-xs text-muted sm:text-sm">Parent device</span>
                            <select
                              id="ot-parent"
                              className={SELECT_ROW}
                              value={form.parentDeviceId}
                              onChange={(e) => setForm((p) => ({ ...p, parentDeviceId: e.target.value }))}
                            >
                              <option value="">None</option>
                              {topologyDevices.map((device) => (
                                <option key={device.id} value={String(device.id)}>
                                  {device.name} {device.ip_address ? `(${device.ip_address})` : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label htmlFor="ot-peer" className="block">
                            <span className="mb-1 block text-xs text-muted sm:text-sm">Network peer</span>
                            <select
                              id="ot-peer"
                              className={SELECT_ROW}
                              value={form.networkPeerId}
                              onChange={(e) => setForm((p) => ({ ...p, networkPeerId: e.target.value }))}
                            >
                              <option value="">None</option>
                              {topologyDevices.map((device) => (
                                <option key={device.id} value={String(device.id)}>
                                  {device.name} {device.ip_address ? `(${device.ip_address})` : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-white/10 bg-[#0c152d]/35 p-4 lg:col-span-2">
                      <SectionHeader icon={Cpu} title="Advanced metadata" subtitle="Optional JSON for integrations." />
                      <textarea
                        rows={5}
                        value={form.advancedMetadataJson}
                        onChange={(e) => setForm((p) => ({ ...p, advancedMetadataJson: e.target.value }))}
                        placeholder='{ "collector_id": "edge-41", "span_port": "Gi1/0/48" }'
                        className="w-full resize-y rounded-xl border border-white/15 bg-[#0c152d]/80 px-3 py-2.5 font-mono text-xs text-text outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/15"
                      />
                      <p className="mt-2 text-[11px] text-muted">
                        Structured onboarding values override duplicate JSON keys.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {formError ? (
            <p className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <Button size="md" loading={saving} onClick={onSubmit}>
              {isEditing ? "Save traffic source" : "Register traffic source"}
            </Button>
            <Button variant="outline" size="md" type="button" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
