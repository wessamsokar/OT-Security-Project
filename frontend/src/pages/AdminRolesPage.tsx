import { useEffect, useMemo, useState } from "react";

import {
  createPermission,
  createRole,
  deletePermission,
  deleteRole,
  fetchPermissions,
  fetchRoles,
  updateRole,
  type PermissionResponse,
  type RoleResponse
} from "../api/rbacApi";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";

type RoleFormState = {
  name: string;
  description: string;
  permissionIds: number[];
};

type PermissionFormState = {
  code: string;
  description: string;
};

const emptyRoleForm: RoleFormState = {
  name: "",
  description: "",
  permissionIds: []
};

const emptyPermissionForm: PermissionFormState = {
  code: "",
  description: ""
};

export function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [permissions, setPermissions] = useState<PermissionResponse[]>([]);
  const [roleForm, setRoleForm] = useState<RoleFormState>(emptyRoleForm);
  const [permissionForm, setPermissionForm] = useState<PermissionFormState>(emptyPermissionForm);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEditing = editingRoleId !== null;

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [rolesData, permissionsData] = await Promise.all([fetchRoles(), fetchPermissions()]);
        if (!active) return;
        setRoles(rolesData);
        setPermissions(permissionsData);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load RBAC data.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const permissionMap = useMemo(
    () => new Map(permissions.map((permission) => [permission.id, permission.code])),
    [permissions]
  );

  const togglePermission = (permissionId: number) => {
    setRoleForm((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permissionId)
        ? prev.permissionIds.filter((id) => id !== permissionId)
        : [...prev.permissionIds, permissionId]
    }));
  };

  const resetRoleForm = () => {
    setRoleForm(emptyRoleForm);
    setEditingRoleId(null);
  };

  const handleRoleSubmit = async () => {
    if (!roleForm.name.trim()) {
      setError("Role name is required.");
      return;
    }

    setSaving(true);
    try {
      if (isEditing && editingRoleId !== null) {
        const updated = await updateRole(editingRoleId, {
          name: roleForm.name.trim(),
          description: roleForm.description.trim() || null,
          permission_ids: roleForm.permissionIds
        });
        setRoles((prev) => prev.map((role) => (role.id === updated.id ? updated : role)));
      } else {
        const created = await createRole({
          name: roleForm.name.trim(),
          description: roleForm.description.trim() || null,
          permission_ids: roleForm.permissionIds
        });
        setRoles((prev) => [created, ...prev]);
      }

      resetRoleForm();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save role.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditRole = (role: RoleResponse) => {
    setEditingRoleId(role.id);
    setRoleForm({
      name: role.name,
      description: role.description ?? "",
      permissionIds: role.permissions.map((permission) => permission.id)
    });
  };

  const handleDeleteRole = async (role: RoleResponse) => {
    if (role.is_system) {
      setError("System roles cannot be deleted.");
      return;
    }

    const confirmDelete = window.confirm("Delete this role?");
    if (!confirmDelete) return;

    setSaving(true);
    try {
      await deleteRole(role.id);
      setRoles((prev) => prev.filter((row) => row.id !== role.id));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete role.");
    } finally {
      setSaving(false);
    }
  };

  const handlePermissionSubmit = async () => {
    if (!permissionForm.code.trim()) {
      setError("Permission code is required.");
      return;
    }

    setSaving(true);
    try {
      const created = await createPermission({
        code: permissionForm.code.trim(),
        description: permissionForm.description.trim() || null
      });
      setPermissions((prev) => [created, ...prev]);
      setPermissionForm(emptyPermissionForm);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create permission.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePermission = async (permissionId: number) => {
    const confirmDelete = window.confirm("Delete this permission?");
    if (!confirmDelete) return;

    setSaving(true);
    try {
      await deletePermission(permissionId);
      setPermissions((prev) => prev.filter((row) => row.id !== permissionId));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete permission.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.16em] text-brand">Admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Roles & Permissions</h1>
        <p className="mt-1 text-sm text-muted">Create and maintain RBAC roles and permission sets.</p>
      </div>

      {loading ? <p className="text-sm text-muted">Loading RBAC data...</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Create permission</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <InputField
                id="permission-code"
                label="Code"
                value={permissionForm.code}
                onChange={(value) => setPermissionForm((prev) => ({ ...prev, code: value }))}
                placeholder="devices.read"
              />
              <InputField
                id="permission-description"
                label="Description"
                value={permissionForm.description}
                onChange={(value) => setPermissionForm((prev) => ({ ...prev, description: value }))}
                placeholder="View assigned devices"
              />
            </div>
            <div className="mt-3">
              <Button onClick={handlePermissionSubmit} loading={saving}>Create permission</Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Create or edit role</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <InputField
                id="role-name"
                label="Role name"
                value={roleForm.name}
                onChange={(value) => setRoleForm((prev) => ({ ...prev, name: value }))}
                placeholder="incident_manager"
              />
              <InputField
                id="role-description"
                label="Description"
                value={roleForm.description}
                onChange={(value) => setRoleForm((prev) => ({ ...prev, description: value }))}
                placeholder="Manages triage and incident workflows"
              />
            </div>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Assign permissions</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {permissions.map((permission) => (
                  <label key={permission.id} className="flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={roleForm.permissionIds.includes(permission.id)}
                      onChange={() => togglePermission(permission.id)}
                      className="h-4 w-4 rounded border-white/20 bg-white/10 text-brand"
                    />
                    <span className="text-white">{permission.code}</span>
                    <span className="text-xs text-muted">{permission.description ?? ""}</span>
                  </label>
                ))}
              </div>
              {!permissions.length ? <p className="mt-2 text-sm text-muted">Create permissions first.</p> : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={handleRoleSubmit} loading={saving}>
                {isEditing ? "Update role" : "Create role"}
              </Button>
              {isEditing ? (
                <Button variant="outline" onClick={resetRoleForm}>Cancel</Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Roles</p>
            <div className="mt-3 space-y-3">
              {roles.map((role) => (
                <div key={role.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-white">{role.name}</p>
                      <p className="text-xs text-muted">{role.description ?? "No description"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEditRole(role)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteRole(role)}
                        disabled={role.is_system}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                    {role.permissions.length
                      ? role.permissions.map((permission) => (
                          <span key={permission.id} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                            {permission.code}
                          </span>
                        ))
                      : "No permissions"}
                  </div>
                </div>
              ))}
              {!roles.length ? <p className="text-sm text-muted">No roles configured yet.</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Permissions</p>
            <div className="mt-3 space-y-2">
              {permissions.map((permission) => (
                <div key={permission.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <div>
                    <p className="text-sm text-white">{permission.code}</p>
                    <p className="text-xs text-muted">{permission.description ?? "No description"}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleDeletePermission(permission.id)}>
                    Remove
                  </Button>
                </div>
              ))}
              {!permissions.length ? <p className="text-sm text-muted">No permissions yet.</p> : null}
            </div>
          </div>
        </div>
      </div>

      {permissions.length ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-muted">
          <p>Permission IDs map:</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {Array.from(permissionMap.entries()).map(([id, code]) => (
              <span key={id}>{id}: {code}</span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
