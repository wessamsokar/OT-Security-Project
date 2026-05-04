import { useEffect, useState } from "react";

import {
  createRole,
  deleteRole,
  fetchRoles,
  updateRole,
  type RoleResponse
} from "../api/rbacApi";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";

type RoleFormState = {
  name: string;
  description: string;
};

const emptyRoleForm: RoleFormState = {
  name: "",
  description: ""
};

export function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [roleForm, setRoleForm] = useState<RoleFormState>(emptyRoleForm);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEditing = editingRoleId !== null;

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const rolesData = await fetchRoles();
        if (!active) return;
        setRoles(rolesData);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load roles.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

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
          description: roleForm.description.trim() || null
        });
        setRoles((prev) => prev.map((role) => (role.id === updated.id ? updated : role)));
      } else {
        const created = await createRole({
          name: roleForm.name.trim(),
          description: roleForm.description.trim() || null
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
      description: role.description ?? ""
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

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.16em] text-brand">Admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Roles</h1>
        <p className="mt-1 text-sm text-muted">Create and maintain role definitions.</p>
      </div>

      {loading ? <p className="text-sm text-muted">Loading RBAC data...</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
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
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleRoleSubmit} loading={saving}>
              {isEditing ? "Update role" : "Create role"}
            </Button>
            {isEditing ? (
              <Button variant="outline" onClick={resetRoleForm}>Cancel</Button>
            ) : null}
          </div>
        </div>

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
              </div>
            ))}
            {!roles.length ? <p className="text-sm text-muted">No roles configured yet.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
