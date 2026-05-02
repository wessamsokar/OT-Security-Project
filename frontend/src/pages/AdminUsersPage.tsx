import { useEffect, useMemo, useState } from "react";

import { fetchRoles, fetchUserRoles, updateUserRoles, type RoleResponse } from "../api/rbacApi";
import { createUser, deleteUser, fetchUsers, updateUser, type UserAdminResponse } from "../api/usersApi";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";

export function AdminUsersPage() {
  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState<UserAdminResponse[]>([]);
  const [query, setQuery] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "analyst" | "viewer">("viewer");
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [currentRoles, setCurrentRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [rows, userRows] = await Promise.all([fetchRoles(), fetchUsers()]);
        if (!active) return;
        setRoles(rows);
        setUsers(userRows);
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

  const rolesById = useMemo(() => new Map(roles.map((role) => [role.id, role.name])), [roles]);

  const loadUsers = async (search?: string) => {
    const rows = await fetchUsers(search);
    setUsers(rows);
  };

  const handleLoad = async () => {
    if (!userId.trim()) {
      setError("User ID is required.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetchUserRoles(Number(userId));
      setSelectedRoleIds(response.roles.map((role) => role.id));
      setCurrentRoles(response.roles.map((role) => role.name));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load user roles.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!userId.trim()) {
      setError("User ID is required.");
      return;
    }

    setSaving(true);
    try {
      const response = await updateUserRoles(Number(userId), selectedRoleIds);
      setCurrentRoles(response.roles.map((role) => role.name));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user roles.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUsername.trim() || !newEmail.trim() || newPassword.length < 8) {
      setError("Username, email, and password (min 8 chars) are required.");
      return;
    }

    setSaving(true);
    try {
      await createUser({
        username: newUsername.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole
      });
      await loadUsers();
      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("viewer");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create user.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    const confirmDelete = window.confirm("Delete this user?");
    if (!confirmDelete) return;
    setSaving(true);
    try {
      await deleteUser(id);
      await loadUsers(query.trim() || undefined);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete user.");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickPromote = async (id: number, role: "admin" | "analyst" | "viewer") => {
    setSaving(true);
    try {
      await updateUser(id, { role });
      await loadUsers(query.trim() || undefined);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user role.");
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (roleId: number) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.16em] text-brand">Admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">User Access Control</h1>
        <p className="mt-1 text-sm text-muted">Assign roles to platform users and manage access levels.</p>
      </div>

      {loading ? <p className="text-sm text-muted">Loading roles...</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.16em] text-muted">Users CRUD</p>
          <div className="grid gap-3 md:grid-cols-2">
            <InputField
              id="admin-create-username"
              label="Username"
              value={newUsername}
              onChange={setNewUsername}
              placeholder="new.user"
            />
            <InputField
              id="admin-create-email"
              label="Email"
              value={newEmail}
              onChange={setNewEmail}
              placeholder="new.user@company.com"
            />
            <InputField
              id="admin-create-password"
              label="Password"
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Strong password"
            />
            <label className="block">
              <span className="mb-2 block text-sm text-muted">Role</span>
              <select
                value={newRole}
                onChange={(event) => setNewRole(event.target.value as "admin" | "analyst" | "viewer")}
                className="w-full rounded-xl border border-white/15 bg-[#0c152d]/80 px-3 py-3 text-sm text-text outline-none transition focus:border-brand/70 focus:ring-2 focus:ring-brand/20"
              >
                <option value="viewer">viewer</option>
                <option value="analyst">analyst</option>
                <option value="admin">admin</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleCreateUser} loading={saving}>Create user</Button>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3">
            <InputField
              id="admin-users-search"
              label="Search users"
              value={query}
              onChange={setQuery}
              placeholder="username or email"
            />
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  setSaving(true);
                  try {
                    await loadUsers(query.trim() || undefined);
                  } finally {
                    setSaving(false);
                  }
                }}
                loading={saving}
              >
                Search
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  setQuery("");
                  setSaving(true);
                  try {
                    await loadUsers();
                  } finally {
                    setSaving(false);
                  }
                }}
                loading={saving}
              >
                Reset
              </Button>
            </div>

            <div className="mt-3 space-y-2">
              {users.map((user) => (
                <div key={user.id} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-muted">
                  <p className="text-white">{user.username} ({user.email})</p>
                  <p>id={user.id} role={user.role} active={String(user.is_active)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => {
                      setUserId(String(user.id));
                      setCurrentRoles([]);
                    }}>Select</Button>
                    <Button size="sm" variant="outline" onClick={() => handleQuickPromote(user.id, "admin")}>Make admin</Button>
                    <Button size="sm" variant="outline" onClick={() => handleQuickPromote(user.id, "analyst")}>Make analyst</Button>
                    <Button size="sm" variant="outline" onClick={() => handleQuickPromote(user.id, "viewer")}>Make viewer</Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeleteUser(user.id)}>Delete</Button>
                  </div>
                </div>
              ))}
              {!users.length ? <p className="text-sm text-muted">No users found.</p> : null}
            </div>
          </div>

          <div className="my-5 h-px bg-white/10" />
          <InputField
            id="admin-user-id"
            label="User ID"
            value={userId}
            onChange={setUserId}
            placeholder="Enter user id"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleLoad} loading={saving}>
              Load roles
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Save changes
            </Button>
          </div>

          <div className="mt-5 space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Assign roles</p>
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={selectedRoleIds.includes(role.id)}
                  onChange={() => toggleRole(role.id)}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 text-brand"
                />
                <span className="text-white">{role.name}</span>
                <span className="text-xs text-muted">{role.description ?? ""}</span>
              </label>
            ))}
            {!roles.length ? <p className="text-sm text-muted">No roles configured yet.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Current roles</p>
          <div className="mt-3 space-y-2">
            {currentRoles.length ? (
              currentRoles.map((roleName) => (
                <div key={roleName} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                  {roleName}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">Load a user to see assigned roles.</p>
            )}
          </div>

          <div className="mt-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Role map</p>
            <div className="mt-2 space-y-1 text-xs text-muted">
              {Array.from(rolesById.entries()).map(([id, name]) => (
                <div key={id}>{id}: {name}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
