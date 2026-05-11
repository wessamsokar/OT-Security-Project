import type { LucideIcon } from "lucide-react";
import { ChevronDown, Cpu, Layers3, Radar, Shield, Sparkles, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../ui/Button";
import { InputField } from "../ui/InputField";

import {
  ASSET_TYPE_OPTIONS,
  CRITICALITY_OPTIONS,
  MONITORING_MODE_OPTIONS,
  NETWORK_ZONE_OPTIONS,
  PROTOCOL_OPTIONS,
  TRAFFIC_SOURCE_OPTIONS
} from "./otAssetOptions";
import type { OtTrafficSourceFormValues } from "./otAssetMetadata";

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
  last_ml_risk_score: number | null;
  last_ml_status: string | null;
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
  form: OtTrafficSourceFormValues;
  setForm: React.Dispatch<React.SetStateAction<OtTrafficSourceFormValues>>;
  saving: boolean;
  formError: string;
  onSubmit: () => void;
  onClose: () => void;
};

export function OtTrafficSourceModal({
  open,
  isEditing,
  mlSnapshot,
  form,
  setForm,
  saving,
  formError,
  onSubmit,
  onClose
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  useEffect(() => {
    if (open) setShowAdvanced(false);
  }, [open]);

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
                OT telemetry onboarding
              </div>
              <h2 id="ot-register-title" className="mt-1.5 text-lg font-semibold text-white md:text-xl">
                {isEditing ? "Edit traffic source" : "Register OT traffic source"}
              </h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted md:text-sm">
                Add a monitored OT asset for protocol-aware traffic ingestion, security telemetry, and ML-based attack
                analytics.
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
          <div className="grid gap-4 lg:grid-cols-2 lg:gap-x-5 lg:gap-y-4">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0c152d]/35 p-4 shadow-inner shadow-black/20 lg:col-span-2">
              <SectionHeader
                icon={Cpu}
                title="A · Asset information"
                subtitle="Industrial identity, criticality, and site context."
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-4 lg:gap-y-3">
                <div className="sm:col-span-2 lg:col-span-1">
                  <InputField
                    compact
                    id="ot-asset-name"
                    label="Asset name *"
                    placeholder="PLC-Substation-01"
                    value={form.name}
                    onChange={(value) => setForm((p) => ({ ...p, name: value }))}
                  />
                </div>
                <div>
                  <label htmlFor="ot-asset-type" className="block min-w-0">
                    <span className="mb-1 block text-xs text-muted sm:text-sm">Asset type *</span>
                    <select
                      id="ot-asset-type"
                      className={SELECT_ROW}
                      value={form.assetType}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          assetType: e.target.value
                        }))
                      }
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
                  <label htmlFor="ot-criticality" className="block min-w-0">
                    <span className="mb-1 block text-xs text-muted sm:text-sm">Criticality level</span>
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
                </div>
                <div className="sm:col-span-2">
                  <InputField
                    compact
                    id="ot-site-loc"
                    label="Site / location"
                    placeholder="Substation North — Bay 2"
                    value={form.siteLocation}
                    onChange={(value) => setForm((p) => ({ ...p, siteLocation: value }))}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label htmlFor="ot-desc" className="block">
                    <span className="mb-1 block text-xs text-muted sm:text-sm">Device description</span>
                    <textarea
                      id="ot-desc"
                      rows={2}
                      placeholder="e.g. Modbus PLC handling feeder protection; passive SPAN on control VLAN."
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      className="min-h-[3.25rem] w-full resize-y rounded-xl border border-white/15 bg-[#0c152d]/80 px-2.5 py-2 text-sm leading-snug text-text outline-none transition placeholder:text-muted/70 focus:border-brand/70 focus:ring-2 focus:ring-brand/20"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0c152d]/35 p-4 shadow-inner shadow-black/20 lg:col-span-1">
              <SectionHeader
                icon={Layers3}
                title="B · Network configuration"
                subtitle="Connectivity, protocol context, and segmentation zone."
              />
              <div className="space-y-2.5">
                <InputField
                  compact
                  id="ot-ip"
                  label="IP address"
                  placeholder="10.0.1.12"
                  value={form.ipAddress}
                  onChange={(value) => setForm((p) => ({ ...p, ipAddress: value }))}
                />
                <InputField
                  compact
                  id="ot-mac"
                  label="MAC address (optional)"
                  placeholder="00:1A:2B:3C:4D:5E"
                  value={form.macAddress}
                  onChange={(value) => setForm((p) => ({ ...p, macAddress: value }))}
                />
                <div>
                  <label htmlFor="ot-protocol" className="block">
                    <span className="mb-1 block text-xs text-muted sm:text-sm">Protocol type</span>
                    <select
                      id="ot-protocol"
                      className={SELECT_ROW}
                      value={form.protocolType}
                      onChange={(e) => {
                        const next = e.target.value;
                        const def = PROTOCOL_OPTIONS.find((p) => p.value === next)?.defaultPort;
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
                <div className="grid grid-cols-2 gap-2">
                  <InputField
                    compact
                    id="ot-port"
                    label="Port"
                    placeholder="502"
                    value={form.portNumber}
                    onChange={(value) => setForm((p) => ({ ...p, portNumber: value }))}
                  />
                  <label htmlFor="ot-zone" className="block min-w-0">
                    <span className="mb-1 block text-xs text-muted sm:text-sm">Network zone</span>
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
                <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/5 px-2 py-0.5">
                    <Wifi size={11} /> Passive monitoring baseline
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/5 px-2 py-0.5">
                    <Radar size={11} /> {protocolLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0c152d]/35 p-4 shadow-inner shadow-black/20 lg:col-span-1">
              <SectionHeader icon={Radar} title="C · Traffic monitoring" subtitle="Capture mode, ingestion path, telemetry rate." />
              <div className="space-y-2.5">
                <label htmlFor="ot-source-type" className="block">
                  <span className="mb-1 block text-xs text-muted sm:text-sm">Traffic source type</span>
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
                <label htmlFor="ot-mon-mode" className="block">
                  <span className="mb-1 block text-xs text-muted sm:text-sm">Monitoring mode</span>
                  <select
                    id="ot-mon-mode"
                    className={SELECT_ROW}
                    value={form.monitoringMode}
                    onChange={(e) => setForm((p) => ({ ...p, monitoringMode: e.target.value }))}
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
                <GlowToggle
                  id="ot-pcap"
                  label="Packet capture enabled"
                  description="Retain PCAP-capable ingestion for offline analyst replay (SOC policy dependent)."
                  checked={form.packetCaptureEnabled}
                  onChange={(v) => setForm((p) => ({ ...p, packetCaptureEnabled: v }))}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0c152d]/35 p-4 shadow-inner shadow-black/20 lg:col-span-2">
              <SectionHeader icon={Shield} title="D · Security & detection" subtitle="ML pipeline participation and realtime SOC visibility." />
              <div className="grid gap-3 md:grid-cols-2">
                <GlowToggle
                  id="ot-ml"
                  label="ML threat detection"
                  description="Include this asset in supervised ML anomaly & attack classification."
                  checked={form.mlThreatDetection}
                  onChange={(v) => setForm((p) => ({ ...p, mlThreatDetection: v }))}
                />
                <GlowToggle
                  id="ot-rt"
                  label="Real-time monitoring"
                  description="Streaming telemetry pathway for alerting and incident timelines."
                  checked={form.realtimeMonitoring}
                  onChange={(v) => setForm((p) => ({ ...p, realtimeMonitoring: v }))}
                />
                <div className="md:col-span-2 flex flex-col gap-2 rounded-xl border border-brand/25 bg-brand/5 px-3 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Shield size={18} className="text-brand" />
                    ML risk &amp; status (read-only)
                  </div>
                  {isEditing && mlSnapshot && (mlSnapshot.last_ml_risk_score != null || mlSnapshot.last_ml_status) ? (
                    <div className="flex flex-wrap items-end justify-between gap-3 text-sm">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted">Risk score</p>
                        <p className="text-xl font-semibold text-brand">
                          {mlSnapshot.last_ml_risk_score != null
                            ? `${(mlSnapshot.last_ml_risk_score * 100).toFixed(1)}%`
                            : "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-wide text-muted">ML status</p>
                        <p className="font-medium capitalize text-text">{formatMlStatusLabel(mlSnapshot.last_ml_status)}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] leading-relaxed text-muted">
                      Scores and anomaly class are produced only by the platform ML pipeline after matching traffic is
                      ingested and analyzed. Register the asset IP so flows can bind to this inventory record.
                    </p>
                  )}
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/12 bg-white/[0.02] px-3 py-2 text-sm text-muted md:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                    className="h-4 w-4 shrink-0 rounded border-white/20 bg-[#0c152d]/80 text-brand accent-brand"
                  />
                  <span className="text-xs leading-snug md:text-sm">
                    Mark traffic source operational in workspace inventory. Live monitoring state is assigned by the
                    backend from observed traffic and ML results.
                  </span>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] lg:col-span-2">
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
                <div className="border-t border-white/10 px-4 pb-4 pt-3">
                  <textarea
                    rows={5}
                    value={form.advancedMetadataJson}
                    onChange={(e) => setForm((p) => ({ ...p, advancedMetadataJson: e.target.value }))}
                    placeholder='{ "collector_id": "edge-41", "span_port": "Gi1/0/48" }'
                    className="w-full resize-y rounded-xl border border-white/15 bg-[#0c152d]/80 px-3 py-2.5 font-mono text-xs text-text outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/15"
                  />
                  <p className="mt-2 text-[11px] text-muted">
                    Merged beneath structured ingestion fields — duplicate keys adopt the onboarding form values shown
                    above.
                  </p>
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
