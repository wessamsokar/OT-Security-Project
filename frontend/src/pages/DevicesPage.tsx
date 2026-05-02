import { useEffect, useMemo, useState } from "react";

import { createDevice, deleteDevice, fetchDevices, updateDevice, type DeviceResponse } from "../api/devicesApi";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";

type DeviceFormState = {
  name: string;
  deviceType: string;
  ipAddress: string;
  serialNumber: string;
  location: string;
  metadataJson: string;
  isActive: boolean;
};

const emptyForm: DeviceFormState = {
  name: "",
  deviceType: "",
  ipAddress: "",
  serialNumber: "",
  location: "",
  metadataJson: "{}",
  isActive: true
};

function parseMetadata(raw: string): Record<string, unknown> | null {
  if (!raw.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

export function DevicesPage() {
  const [devices, setDevices] = useState<DeviceResponse[]>([]);
  const [form, setForm] = useState<DeviceFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const rows = await fetchDevices();
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
    return () => {
      active = false;
    };
  }, []);

  const isEditing = editingId !== null;
  const tableRows = useMemo(() => devices.slice().sort((a, b) => b.id - a.id), [devices]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError("Device name is required.");
      return;
    }

    const metadata = parseMetadata(form.metadataJson);
    if (!metadata) {
      setFormError("Metadata must be valid JSON.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      if (isEditing && editingId !== null) {
        const updated = await updateDevice(editingId, {
          name: form.name.trim(),
          device_type: form.deviceType.trim() || null,
          ip_address: form.ipAddress.trim() || null,
          serial_number: form.serialNumber.trim() || null,
          location: form.location.trim() || null,
          metadata_json: metadata,
          is_active: form.isActive
        });
        setDevices((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      } else {
        const created = await createDevice({
          name: form.name.trim(),
          device_type: form.deviceType.trim() || null,
          ip_address: form.ipAddress.trim() || null,
          serial_number: form.serialNumber.trim() || null,
          location: form.location.trim() || null,
          metadata_json: metadata,
          is_active: form.isActive
        });
        setDevices((prev) => [created, ...prev]);
      }

      setForm(emptyForm);
      setEditingId(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to save device.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (device: DeviceResponse) => {
    setEditingId(device.id);
    setForm({
      name: device.name ?? "",
      deviceType: device.device_type ?? "",
      ipAddress: device.ip_address ?? "",
      serialNumber: device.serial_number ?? "",
      location: device.location ?? "",
      metadataJson: JSON.stringify(device.metadata_json ?? {}, null, 2),
      isActive: device.is_active
    });
  };

  const handleDelete = async (deviceId: number) => {
    const confirmDelete = window.confirm("Delete this device?");
    if (!confirmDelete) return;

    try {
      await deleteDevice(deviceId);
      setDevices((prev) => prev.filter((row) => row.id !== deviceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete device.");
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.16em] text-brand">Devices</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Device Inventory</h1>
        <p className="mt-1 text-sm text-muted">Manage the OT devices assigned to your workspace.</p>
      </div>

      {loading ? <p className="text-sm text-muted">Loading devices...</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-2">
        <div className="space-y-3">
          <InputField
            id="device-name"
            label="Device name"
            value={form.name}
            onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
            placeholder="PLC-01"
          />
          <InputField
            id="device-type"
            label="Device type"
            value={form.deviceType}
            onChange={(value) => setForm((prev) => ({ ...prev, deviceType: value }))}
            placeholder="PLC, RTU, HMI"
          />
          <InputField
            id="device-ip"
            label="IP address"
            value={form.ipAddress}
            onChange={(value) => setForm((prev) => ({ ...prev, ipAddress: value }))}
            placeholder="10.0.1.12"
          />
          <InputField
            id="device-serial"
            label="Serial number"
            value={form.serialNumber}
            onChange={(value) => setForm((prev) => ({ ...prev, serialNumber: value }))}
            placeholder="SN-4829"
          />
          <InputField
            id="device-location"
            label="Location"
            value={form.location}
            onChange={(value) => setForm((prev) => ({ ...prev, location: value }))}
            placeholder="Plant A - Line 3"
          />
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-2 block text-sm text-muted">Metadata (JSON)</span>
            <textarea
              rows={8}
              value={form.metadataJson}
              onChange={(event) => setForm((prev) => ({ ...prev, metadataJson: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-[#0c152d]/80 px-3 py-3 text-sm text-text outline-none transition placeholder:text-muted/70 focus:border-brand/70 focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              className="h-4 w-4 rounded border-white/20 bg-white/10 text-brand"
            />
            Active device
          </label>
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSubmit} loading={saving}>
              {isEditing ? "Update device" : "Add device"}
            </Button>
            {isEditing ? (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-muted">
            <tr>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((device) => (
              <tr key={device.id} className="border-t border-white/10">
                <td className="px-4 py-3 text-white">{device.name}</td>
                <td className="px-4 py-3 text-muted">{device.device_type ?? "-"}</td>
                <td className="px-4 py-3 text-muted">{device.ip_address ?? "-"}</td>
                <td className="px-4 py-3 text-muted">{device.location ?? "-"}</td>
                <td className="px-4 py-3">
                  <span
                    className={[
                      "inline-flex rounded-full px-2 py-0.5 text-xs",
                      device.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                    ].join(" ")}
                  >
                    {device.is_active ? "active" : "inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{new Date(device.updated_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(device)}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(device.id)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !tableRows.length ? (
              <tr className="border-t border-white/10">
                <td className="px-4 py-3 text-muted" colSpan={7}>
                  No devices found yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
