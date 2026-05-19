import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import {
  createRole,
  deleteRole,
  fetchPermissions,
  fetchRoles,
  fetchRoleUsers,
  updateRole,
  type PermissionResponse,
  type RoleResponse
} from "../api/rbacApi";
import type { UserAdminResponse } from "../api/usersApi";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";

type RoleFormState = {
  name: string;
  description: string;
  permissionIds: number[];
};

const emptyRoleForm: RoleFormState = {
  name: "",
  description: "",
  permissionIds: []
};

// Extracted from requirements
const SYSTEM_ROLES = ["admin", "analyst", "customer", "viewer"];

export function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [permissions, setPermissions] = useState<PermissionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roleForm, setRoleForm] = useState<RoleFormState>(emptyRoleForm);
  const [editingRole, setEditingRole] = useState<RoleResponse | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Assigned Users State
  const [assignedUsers, setAssignedUsers] = useState<UserAdminResponse[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

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

  // Group permissions dynamically
  const permissionGroups = useMemo(() => {
    const groups: Record<string, PermissionResponse[]> = {};
    for (const p of permissions) {
      const parts = p.code.split("_");
      const groupName = parts.length > 1 
        ? parts.slice(1).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ")
        : "General";
      
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(p);
    }
    return groups;
  }, [permissions]);

  const handleOpenCreateModal = () => {
    setRoleForm(emptyRoleForm);
    setEditingRole(null);
    setAssignedUsers([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (role: RoleResponse) => {
    setRoleForm({
      name: role.name,
      description: role.description ?? "",
      permissionIds: role.permissions.map(p => p.id)
    });
    setEditingRole(role);
    setIsModalOpen(true);
    setAssignedUsers([]);

    // Fetch assigned users for this role
    setLoadingUsers(true);
    try {
      const users = await fetchRoleUsers(role.id);
      setAssignedUsers(users);
    } catch (err) {
      console.error("Failed to load assigned users", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleRoleSubmit = async () => {
    if (!roleForm.name.trim()) {
      setError("Role name is required.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (editingRole) {
        const updated = await updateRole(editingRole.id, {
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
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save role.");
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (permissionId: number) => {
    if (editingRole?.is_system) return; // Prevent toggling for system roles
    setRoleForm((prev) => {
      const selected = prev.permissionIds.includes(permissionId);
      return {
        ...prev,
        permissionIds: selected
          ? prev.permissionIds.filter((id) => id !== permissionId)
          : [...prev.permissionIds, permissionId]
      };
    });
  };

  const handleDeleteRole = async (role: RoleResponse) => {
    if (role.is_system) {
      setError("System roles cannot be deleted.");
      return;
    }

    const confirmDelete = window.confirm(`Delete the role "${role.name}"?`);
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
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-brand">Access Control</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Roles & Permissions</h1>
        </div>
        <Button onClick={handleOpenCreateModal} className="shadow-lg shadow-brand/20">
          Add Role
        </Button>
      </div>

      {loading ? <p className="text-sm text-muted">Loading RBAC data...</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {roles.map((role) => {
          const isSystem = role.is_system || SYSTEM_ROLES.includes(role.name.toLowerCase());
          return (
            <div 
              key={role.id} 
              className="group flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.04]"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-white truncate">{role.name}</h3>
                  {isSystem && (
                    <span className="shrink-0 rounded-md border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand">
                      System
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted line-clamp-2">
                  {role.description || "No description provided."}
                </p>
                
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-md bg-white/5 px-2 py-1 text-xs text-muted border border-white/5">
                    {role.permissions.length} Permissions
                  </span>
                  <span className="rounded-md bg-white/5 px-2 py-1 text-xs text-muted border border-white/5">
                    {role.assigned_users_count} Users
                  </span>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2 border-t border-white/5 pt-4">
                <Button size="sm" variant="ghost" className="flex-1" onClick={() => handleOpenEditModal(role)}>
                  {isSystem ? "View" : "Edit"}
                </Button>
                {!isSystem && (
                  <Button size="sm" variant="outline" className="flex-1 border-rose-500/30 text-rose-400 hover:bg-rose-500/10" onClick={() => handleDeleteRole(role)}>
                    Delete
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={handleCloseModal}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="flex w-full max-w-4xl max-h-[90vh] flex-col rounded-2xl border border-white/10 bg-[#0c152d]/95 shadow-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 p-6">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {editingRole ? (editingRole.is_system ? "View Role" : "Edit Role") : "Create Role"}
                  </h2>
                  {editingRole?.is_system && (
                    <span className="mt-2 inline-block rounded-md border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand">
                      Protected system role
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={handleCloseModal}>
                  Close
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {/* SECTION 1 - Role Info */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <InputField
                    id="modal-role-name"
                    label="Role Name"
                    value={roleForm.name}
                    onChange={(val) => setRoleForm((prev) => ({ ...prev, name: val }))}
                    disabled={editingRole?.is_system}
                    placeholder="e.g. tier1_analyst"
                  />
                  <InputField
                    id="modal-role-desc"
                    label="Description"
                    value={roleForm.description}
                    onChange={(val) => setRoleForm((prev) => ({ ...prev, description: val }))}
                    disabled={editingRole?.is_system}
                    placeholder="Role purpose..."
                  />
                </div>

                {/* SECTION 2 - Permissions */}
                <div>
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
                    Permissions
                  </h3>
                  <div className="space-y-6">
                    {Object.entries(permissionGroups).map(([group, perms]) => (
                      <div key={group}>
                        <p className="mb-2 text-xs font-medium text-white/70">{group}</p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {perms.map((p) => {
                            const isChecked = roleForm.permissionIds.includes(p.id);
                            return (
                              <label
                                key={p.id}
                                className={`flex items-start gap-3 rounded-xl border p-3 transition-colors duration-200 ${
                                  editingRole?.is_system ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:border-brand/40 hover:bg-white/[0.04]"
                                } ${isChecked ? "border-brand/40 bg-brand/5" : "border-white/5 bg-white/[0.02]"}`}
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5 shrink-0 rounded border-white/20 bg-black/20 text-brand focus:ring-brand/50 disabled:opacity-50"
                                  checked={isChecked}
                                  disabled={editingRole?.is_system}
                                  onChange={() => togglePermission(p.id)}
                                />
                                <div>
                                  <span className={`block text-sm font-medium ${isChecked ? "text-white" : "text-muted"}`}>
                                    {p.code}
                                  </span>
                                  <span className="mt-0.5 block text-xs text-white/40 line-clamp-2">
                                    {p.description || "No description"}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECTION 3 - Assigned Users (Edit mode only) */}
                {editingRole && (
                  <div className="border-t border-white/10 pt-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
                        Assigned Users
                      </h3>
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white">
                        {assignedUsers.length}
                      </span>
                    </div>
                    
                    {loadingUsers ? (
                      <p className="text-sm text-muted">Loading assigned users...</p>
                    ) : assignedUsers.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {assignedUsers.map(user => (
                          <div 
                            key={user.id} 
                            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5"
                          >
                            <div className={`h-2 w-2 rounded-full ${user.is_active ? "bg-emerald-500" : "bg-rose-500"}`} />
                            <span className="text-sm text-white">{user.username}</span>
                            <span className="text-xs text-muted">({user.email})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted italic">No users currently assigned to this role.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-white/10 bg-white/[0.02] p-6 rounded-b-2xl">
                <Button variant="ghost" onClick={handleCloseModal}>
                  Cancel
                </Button>
                {!editingRole?.is_system && (
                  <Button onClick={handleRoleSubmit} loading={saving}>
                    {editingRole ? "Save Changes" : "Create Role"}
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
