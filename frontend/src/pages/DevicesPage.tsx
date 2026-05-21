import { useEffect, useMemo, useRef, useState } from "react";

import { OtTrafficSourceModal } from "../components/devices/OtTrafficSourceModal";
import type { RelationshipPanelRef } from "../components/devices/RelationshipPanel";
import {
  buildMetadataPayload,
  defaultOtTrafficSourceForm,
  formValuesFromDevice,
  OT_META,
  parseAdvancedMetadataJson,
  resolveMonitoringBadge,
  resolveOperationalBadge,
  type OtTrafficSourceFormValues
} from "../components/devices/otAssetMetadata";
import { createDevice, deleteDevice, clearDeviceAttack, acknowledgeDeviceAttack, fetchDevices, updateDevice, type DeviceResponse } from "../api/devicesApi";
import { Button } from "../components/ui/Button";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";

export function DevicesPage() {
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [form, setForm] = useState<OtTrafficSourceFormValues>(() => defaultOtTrafficSourceForm());
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const { hasPermission } = useAuth();
  const { activeTenantId, canSelectTenant, assignedCustomers, isLoadingAssignments } = useTenant();
  const tenantId = canSelectTenant ? activeTenantId : undefined;
  const panelRef = useRef<RelationshipPanelRef | null>(null);
  const canCreateDevices = hasPermission("create_devices");
  const canEditDevices = hasPermission("edit_devices");
  const canDeleteDevices = hasPermission("delete_devices");
  const canManageDevices = canCreateDevices || canEditDevices || canDeleteDevices;

  /**
   * Best-effort topology refresh after any mutation.
   * The topology graph (OtInventoryPage) runs its own SSE loop and will pick up
   * changes within the SSE interval. This call pre-empts that wait so the graph
   * updates immediately if the user navigates to the Topology view right away.
   * It is intentionally fire-and-forget — failures are silent.
   */
  const refreshTopologyIfMounted = useRef(async () => {
    // no-op placeholder; actual refresh done by SSE on OtInventoryPage
    // kept here for future: if DevicesPage gets its own TopologyProvider, wire applySnapshot here.
  }).current;

  useEffect(() => {
    let active = true;

    if (canSelectTenant && isLoadingAssignments) {
      return () => {
        active = false;
      };
    }

    if (canSelectTenant && assignedCustomers.length === 0) {
      setError("No customer tenants assigned. Contact an administrator.");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const load = async () => {
      try {
        const rows = await fetchDevices(tenantId);
        if (!active) return;
        setDevices(rows);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load devices.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    // Poll every 10s for live telemetry status changes, but only if tab is visible
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load();
      }
    }, 10000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [tenantId, canSelectTenant, isLoadingAssignments, assignedCustomers.length]);

  const isEditing = editingId !== null;
  const tableRows = useMemo(() => devices.slice().sort((a, b) => b.id - a.id), [devices]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError("Device name is required.");
      return;
    }
    if (!form.assetType.trim()) {
      setFormError("Device type is required.");
      return;
    }
    if (!form.ipAddress.trim()) {
      setFormError("IP address is required.");
      return;
    }
    if (!form.protocolType.trim()) {
      setFormError("Protocol is required.");
      return;
    }

    let extraAdvanced: Record<string, unknown> | undefined;
    try {
      const parsed = parseAdvancedMetadataJson(form.advancedMetadataJson);
      extraAdvanced = Object.keys(parsed).length > 0 ? parsed : undefined;
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invalid advanced metadata.");
      return;
    }

    const metadata = buildMetadataPayload(form, {
      extraAdvanced
    });

    setSaving(true);
    setFormError("");
    try {
      if (isEditing && editingId !== null) {
        if (!canEditDevices) {
          setFormError("You do not have permission to edit devices.");
          return;
        }
        const updated = await updateDevice(editingId, {
          name: form.name.trim(),
          device_type: form.assetType.trim() || null,
          ip_address: form.ipAddress.trim() || null,
          serial_number: null,
          location: form.siteLocation.trim() || null,
          metadata_json: metadata,
          is_active: form.isActive
        });
        setDevices((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
        void refreshTopologyIfMounted();
      } else {
        if (!canCreateDevices) {
          setFormError("You do not have permission to create devices.");
          return;
        }
        const created = await createDevice({
          name: form.name.trim(),
          user_id: form.customerId,
          device_type: form.assetType.trim() || null,
          ip_address: form.ipAddress.trim() || null,
          serial_number: null,
          location: form.siteLocation.trim() || null,
          metadata_json: metadata,
          is_active: form.isActive
        });
        setDevices((prev) => [created, ...prev]);
        // flush any queued pending edges now that we have a device ID
        if (panelRef.current) {
          await panelRef.current.flushPendingEdges(created.id);
        }
        void refreshTopologyIfMounted();
      }

      setForm(defaultOtTrafficSourceForm());
      setEditingId(null);
      setShowFormModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to save traffic source.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (device: DeviceResponse) => {
    setEditingId(device.id);
    setFormError("");
    setForm(formValuesFromDevice(device));
    setShowFormModal(true);
  };

  const handleDelete = async (deviceId: number) => {
    if (!canDeleteDevices) {
      setError("You do not have permission to delete devices.");
      return;
    }
    const confirmDelete = window.confirm("Remove this traffic source from monitoring inventory?");
    if (!confirmDelete) return;

    try {
      await deleteDevice(deviceId);
      setDevices((prev) => prev.filter((row) => row.id !== deviceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete traffic source.");
    }
  };

  const handleClearAttack = async (deviceId: number) => {
    if (!canEditDevices) {
      setError("You do not have permission to edit devices.");
      return;
    }
    try {
      const updated = await clearDeviceAttack(deviceId, "Manual resolve");
      setDevices((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      void refreshTopologyIfMounted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to clear attack status.");
    }
  };

  const handleAcknowledgeAttack = async (deviceId: number) => {
    if (!canEditDevices) {
      setError("You do not have permission to edit devices.");
      return;
    }
    try {
      const updated = await acknowledgeDeviceAttack(deviceId, "Manual acknowledgment");
      setDevices((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      void refreshTopologyIfMounted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to acknowledge alert.");
    }
  };

  const closeModal = () => {
    setShowFormModal(false);
    setFormError("");
    setEditingId(null);
    setForm(defaultOtTrafficSourceForm());
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-brand">Traffic sources</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">OT asset inventory</h1>
          <p className="mt-1 text-sm text-muted">
            Register industrial assets as monitored traffic sources for protocol-aware telemetry and ML attack detection.
          </p>
        </div>
        {canCreateDevices ? (
          <Button
            onClick={() => {
              setEditingId(null);
              setForm(defaultOtTrafficSourceForm());
              setFormError("");
              setShowFormModal(true);
            }}
          >
            Register OT traffic source
          </Button>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-muted">Loading traffic sources…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-muted">
            <tr>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Site / zone</th>
              <th className="px-4 py-3">Monitoring</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((device) => {
              const mlBadge = resolveMonitoringBadge(device);
              const opBadge = resolveOperationalBadge(device);
              const meta =
                device.metadata_json && typeof device.metadata_json === "object"
                  ? (device.metadata_json as Record<string, unknown>)
                  : {};
              const proto = typeof meta[OT_META.protocol] === "string" ? (meta[OT_META.protocol] as string) : "";

              return (
                <tr key={device.id} className="border-t border-white/10">
                  <td className="px-4 py-3 text-white">{device.name}</td>
                  <td className="px-4 py-3 text-muted">{device.device_type ?? "-"}</td>
                  <td className="px-4 py-3 text-muted">
                    {device.ip_address ?? "-"}{" "}
                    {proto ? (
                      <span className="ml-1 inline-block rounded border border-white/10 bg-white/[0.04] px-1.5 py-px text-[10px] text-muted">
                        {proto.replace(/_/g, " ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted">{device.location ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                        opBadge.className
                      ].join(" ")}
                    >
                      {opBadge.label}
                    </span>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${mlBadge.className.split(" ")[0]} ${mlBadge.className.split(" ")[1]}`} />
                      <span className="text-[10px] text-muted">
                        ML {mlBadge.label}
                        {device.last_ml_risk_score != null ? ` · ${(device.last_ml_risk_score * 100).toFixed(0)}% risk` : ""}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{new Date(device.updated_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {canManageDevices ? (
                      <div className="flex flex-wrap gap-2">
                        {canEditDevices ? (
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(device)}>
                            Edit
                          </Button>
                        ) : null}
                        {canEditDevices &&
                        (device.monitoring_status === "under_attack" || device.monitoring_status === "suspicious") && !device.attack_acknowledged_at ? (
                          <Button variant="outline" size="sm" onClick={() => void handleAcknowledgeAttack(device.id)} className="border-amber-500/50 text-amber-200 hover:bg-amber-500/20">
                            Acknowledge
                          </Button>
                        ) : null}
                        {canEditDevices &&
                        (device.monitoring_status === "under_attack" || device.monitoring_status === "suspicious" || device.monitoring_status === "active") && device.operational_state !== "online" ? (
                          <Button variant="outline" size="sm" onClick={() => void handleClearAttack(device.id)} className="border-rose-500/50 text-rose-200 hover:bg-rose-500/20">
                            Resolve
                          </Button>
                        ) : null}
                        {canDeleteDevices ? (
                          <Button variant="outline" size="sm" onClick={() => handleDelete(device.id)}>
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">Read-only</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && !tableRows.length ? (
              <tr className="border-t border-white/10">
                <td className="px-4 py-3 text-muted" colSpan={7}>
                  No monitored traffic sources yet. Register one to begin OT telemetry ingestion.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <OtTrafficSourceModal
        open={showFormModal}
        isEditing={isEditing}
        mlSnapshot={
          isEditing && editingId !== null
            ? (() => {
                const d = devices.find((x) => x.id === editingId);
                return d
                  ? { 
                      id: d.id,
                      last_ml_risk_score: d.last_ml_risk_score, 
                      last_ml_status: d.last_ml_status,
                      last_attack_at: d.last_attack_at,
                      last_recovered_at: d.last_recovered_at,
                      attack_acknowledged_at: d.attack_acknowledged_at,
                      attack_resolved_at: d.attack_resolved_at,
                      monitoring_status: d.monitoring_status,
                      operational_state: d.operational_state
                    }
                  : undefined;
              })()
            : undefined
        }
        existingDevices={devices}
        editingId={editingId}
        form={form}
        setForm={setForm}
        saving={saving}
        formError={formError}
        onSubmit={handleSubmit}
        onClose={closeModal}
        onEdgesChanged={() => void refreshTopologyIfMounted()}
        onPanelRef={(ref) => { panelRef.current = ref; }}
        onClearAttack={(id) => void handleClearAttack(id)}
        onAcknowledgeAttack={(id) => void handleAcknowledgeAttack(id)}
      />
    </section>
  );
}
