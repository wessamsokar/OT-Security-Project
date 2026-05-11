import { useEffect, useState } from "react";

import type { AlertResponse } from "../api/alertsApi";
import type { DeviceResponse } from "../api/devicesApi";
import type { TrafficRecordResponse } from "../api/trafficApi";
import {
  approveOnboardingRegistration,
  createUser,
  deleteUser,
  fetchUser,
  fetchUserAlerts,
  fetchUserDevices,
  fetchUserIncidents,
  fetchUserThreats,
  fetchUserTraffic,
  fetchUsers,
  rejectOnboardingRegistration,
  updateUser,
  type ActiveThreatResponse,
  type IncidentResponse,
  type UserAdminResponse
} from "../api/usersApi";
import { formatIndustry } from "../lib/industryOptions";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";

export function AdminUsersPage() {
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAdminResponse | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit" | null>(null);
  const [userTab, setUserTab] = useState<"devices" | "alerts" | "threats" | "incidents" | "traffic">("devices");
  const [userDevices, setUserDevices] = useState<DeviceResponse[]>([]);
  const [userAlerts, setUserAlerts] = useState<AlertResponse[]>([]);
  const [userThreats, setUserThreats] = useState<ActiveThreatResponse[]>([]);
  const [userIncidents, setUserIncidents] = useState<IncidentResponse[]>([]);
  const [userTraffic, setUserTraffic] = useState<TrafficRecordResponse[]>([]);
  const [userDataLoading, setUserDataLoading] = useState(false);
  const [userDataError, setUserDataError] = useState("");
  const [users, setUsers] = useState<UserAdminResponse[]>([]);
  const [query, setQuery] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "customer">("customer");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "customer">("customer");
  const [editActive, setEditActive] = useState(true);
  const [editEmailVerified, setEditEmailVerified] = useState(false);
  const [newAdminApproved, setNewAdminApproved] = useState(true);
  const [editAdminApproved, setEditAdminApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /** Onboarding / registration review modal (opened from Verify). */
  const [reviewUser, setReviewUser] = useState<UserAdminResponse | null>(null);
  const [reviewOpeningId, setReviewOpeningId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const userRows = await fetchUsers();
        if (!active) return;
        setUsers(userRows);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load users.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const loadUsers = async (search?: string) => {
    const rows = await fetchUsers(search);
    setUsers(rows);
  };

  function onboardingBadgeClass(status: UserAdminResponse["onboarding_status"]): string {
    if (status === "approved") return "rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300";
    if (status === "rejected") return "rounded-md border border-red-500/45 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300";
    return "rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300";
  }

  const openRegistrationReview = async (userRow: UserAdminResponse) => {
    setRejectReason("");
    setReviewError("");
    setError("");
    setReviewOpeningId(userRow.id);
    setReviewUser(userRow);
    try {
      const fresh = await fetchUser(userRow.id);
      setReviewUser(fresh);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load user profile.";
      setReviewError(msg);
      setError(msg);
      setReviewUser(null);
    } finally {
      setReviewOpeningId(null);
    }
  };

  const closeReview = () => {
    setReviewUser(null);
    setRejectReason("");
    setReviewError("");
  };

  const loadUserDetails = async (userId: number) => {
    setUserDataLoading(true);
    setUserDataError("");
    try {
      const [devices, alerts, threats, incidents, traffic] = await Promise.all([
        fetchUserDevices(userId, 50),
        fetchUserAlerts(userId, 50),
        fetchUserThreats(userId, 50),
        fetchUserIncidents(userId, 50),
        fetchUserTraffic(userId, 50)
      ]);
      setUserDevices(devices);
      setUserAlerts(alerts);
      setUserThreats(threats);
      setUserIncidents(incidents);
      setUserTraffic(traffic);
    } catch (err) {
      setUserDataError(err instanceof Error ? err.message : "Unable to load user data.");
    } finally {
      setUserDataLoading(false);
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
        role: newRole,
        is_admin_approved: newAdminApproved
      });
      await loadUsers();
      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("customer");
      setNewAdminApproved(true);
      setIsAddUserOpen(false);
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

  const openViewModal = (user: UserAdminResponse) => {
    setSelectedUser(user);
    setModalMode("view");
    setUserTab("devices");
    setUserDataError("");
    setError("");
    void loadUserDetails(user.id);
  };

  const openEditModal = (user: UserAdminResponse) => {
    setSelectedUser(user);
    setEditUsername(user.username);
    setEditEmail(user.email);
    setEditPassword("");
    setEditRole(user.role);
    setEditActive(user.is_active);
    setEditEmailVerified(user.is_email_verified);
    setEditAdminApproved(user.is_admin_approved);
    setModalMode("edit");
    setError("");
  };

  const closeUserModal = () => {
    setSelectedUser(null);
    setModalMode(null);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    if (!editUsername.trim() || !editEmail.trim()) {
      setError("Username and email are required.");
      return;
    }
    if (editPassword && editPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    try {
      await updateUser(selectedUser.id, {
        username: editUsername.trim(),
        email: editEmail.trim(),
        role: editRole,
        is_active: editActive,
        is_email_verified: editEmailVerified,
        is_admin_approved: editAdminApproved,
        password: editPassword ? editPassword : undefined
      });
      await loadUsers(query.trim() || undefined);
      closeUserModal();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.16em] text-brand">Admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">User Access Control</h1>
        <p className="mt-1 text-sm text-muted">
          Assign roles and approve self-registered accounts before they can sign in.
        </p>
      </div>

      {loading ? <p className="text-sm text-muted">Loading roles...</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.16em] text-muted">Users CRUD</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Create new users and manage access.</p>
            <Button onClick={() => {
              setError("");
              setIsAddUserOpen(true);
            }}>Add user</Button>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <InputField
                  id="admin-users-search"
                  label="Search users"
                  value={query}
                  onChange={setQuery}
                  placeholder="username or email"
                />
              </div>
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
                <div key={user.id} className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-muted">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex shrink-0 items-center justify-start">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={reviewOpeningId === user.id}
                        className="!border-[#722f37]/80 !bg-gradient-to-r !from-[#6b1528] !to-[#5c121f] !text-white shadow-md hover:!brightness-110 focus-visible:!ring-[#9f1239]/60"
                        onClick={() => void openRegistrationReview(user)}
                      >
                        Verify
                      </Button>
                    </div>
                    <div className="flex-1 text-center">
                      <p className="text-sm text-white">{user.username}</p>
                      <p className="text-xs text-muted">{user.email}</p>
                      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                        <span className={onboardingBadgeClass(user.onboarding_status)}>
                          {user.onboarding_status === "pending"
                            ? "Pending verification"
                            : user.onboarding_status === "approved"
                              ? "Approved"
                              : "Rejected"}
                        </span>
                        {user.is_email_verified ? (
                          <span className="rounded-md border border-sky-500/35 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                            Email OK
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase tracking-wide text-muted">Email unverified</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openViewModal(user)}>View</Button>
                      <Button size="sm" variant="outline" onClick={() => openEditModal(user)}>Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteUser(user.id)}>Delete</Button>
                    </div>
                  </div>
                </div>
              ))}
              {!users.length ? <p className="text-sm text-muted">No users found.</p> : null}
            </div>
          </div>

          <div className="my-5 h-px bg-white/10" />
        </div>

      </div>

      {isAddUserOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0c152d]/95 p-6 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-brand">Admin</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Add user</h2>
                <p className="mt-1 text-sm text-muted">Create a new platform user.</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddUserOpen(false)}
              >
                Close
              </Button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
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
                  onChange={(event) => setNewRole(event.target.value as "admin" | "customer")}
                  className="w-full rounded-xl border border-white/15 bg-[#0c152d]/80 px-3 py-3 text-sm text-text outline-none transition focus:border-brand/70 focus:ring-2 focus:ring-brand/20"
                >
                  <option value="customer">customer</option>
                  <option value="admin">admin</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-muted md:col-span-2">
                <input
                  type="checkbox"
                  checked={newAdminApproved}
                  onChange={(event) => setNewAdminApproved(event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 text-brand"
                />
                <span className="text-white">Approved — user can sign in immediately</span>
              </label>
            </div>

            {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={handleCreateUser} loading={saving}>Create user</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setNewUsername("");
                  setNewEmail("");
                  setNewPassword("");
                  setNewRole("customer");
                  setNewAdminApproved(true);
                  setError("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {modalMode && selectedUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0c152d]/95 p-6 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-brand">Admin</p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {modalMode === "view" ? "User details" : "Edit user"}
                </h2>
                <p className="mt-1 text-sm text-muted">{selectedUser.username} ({selectedUser.email})</p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeUserModal}>Close</Button>
            </div>

            {modalMode === "view" ? (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 text-sm text-muted md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Profile</p>
                    <p className="mt-2 text-white">Username: {selectedUser.username}</p>
                    <p className="text-white">Email: {selectedUser.email}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Status</p>
                    <p className="mt-2 text-white">Role: {selectedUser.role}</p>
                    <p className="text-white">Active: {String(selectedUser.is_active)}</p>
                    <p className="text-white">Email verified: {String(selectedUser.is_email_verified)}</p>
                    <p className="text-white">
                      Onboarding: {selectedUser.onboarding_status}
                      {selectedUser.rejected_at ? ` (rejected ${new Date(selectedUser.rejected_at).toLocaleString()})` : ""}
                    </p>
                    <p className="text-white">
                      Admin approved: {String(selectedUser.is_admin_approved)}
                      {selectedUser.admin_approved_at
                        ? ` (${new Date(selectedUser.admin_approved_at).toLocaleString()})`
                        : ""}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Audit</p>
                    <p className="mt-2 text-white">Created: {new Date(selectedUser.created_at).toLocaleString()}</p>
                    <p className="text-white">Verified at: {selectedUser.email_verified_at ? new Date(selectedUser.email_verified_at).toLocaleString() : "-"}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {([
                    { key: "devices", label: "Devices" },
                    { key: "alerts", label: "Alerts" },
                    { key: "threats", label: "Threats" },
                    { key: "incidents", label: "Incidents" },
                    { key: "traffic", label: "Traffic" }
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setUserTab(tab.key)}
                      className={[
                        "rounded-full border px-3 py-1 text-xs transition",
                        userTab === tab.key
                          ? "border-brand/60 bg-brand/20 text-white"
                          : "border-white/10 bg-white/5 text-muted hover:text-white"
                      ].join(" ")}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {userDataLoading ? <p className="text-sm text-muted">Loading user data...</p> : null}
                {userDataError ? <p className="text-sm text-danger">{userDataError}</p> : null}

                {!userDataLoading && !userDataError ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    {userTab === "devices" ? (
                      <div className="space-y-2 text-sm text-muted">
                        {userDevices.map((device) => (
                          <div key={device.id} className="rounded-lg border border-white/10 bg-background/40 p-3">
                            <p className="text-white">{device.name}</p>
                            <p className="text-xs text-muted">Type: {device.device_type ?? "-"} | IP: {device.ip_address ?? "-"}</p>
                            <p className="text-xs text-muted">Location: {device.location ?? "-"} | Active: {String(device.is_active)}</p>
                          </div>
                        ))}
                        {!userDevices.length ? <p className="text-sm text-muted">No devices found.</p> : null}
                      </div>
                    ) : null}

                    {userTab === "alerts" ? (
                      <div className="space-y-2 text-sm text-muted">
                        {userAlerts.map((alert) => (
                          <div key={alert.id} className="rounded-lg border border-white/10 bg-background/40 p-3">
                            <p className="text-white">{alert.summary}</p>
                            <p className="text-xs text-muted">Severity: {alert.severity} | Status: {alert.status}</p>
                            <p className="text-xs text-muted">Created: {new Date(alert.created_at).toLocaleString()}</p>
                          </div>
                        ))}
                        {!userAlerts.length ? <p className="text-sm text-muted">No alerts found.</p> : null}
                      </div>
                    ) : null}

                    {userTab === "threats" ? (
                      <div className="space-y-2 text-sm text-muted">
                        {userThreats.map((threat) => (
                          <div key={threat.threat_id} className="rounded-lg border border-white/10 bg-background/40 p-3">
                            <p className="text-white">{threat.threat_id} - {threat.attack_vector}</p>
                            <p className="text-xs text-muted">Target: {threat.target_asset} | Risk: {threat.risk}</p>
                            <p className="text-xs text-muted">Created: {new Date(threat.created_at).toLocaleString()}</p>
                          </div>
                        ))}
                        {!userThreats.length ? <p className="text-sm text-muted">No active threats found.</p> : null}
                      </div>
                    ) : null}

                    {userTab === "incidents" ? (
                      <div className="space-y-2 text-sm text-muted">
                        {userIncidents.map((incident) => (
                          <div key={incident.id} className="rounded-lg border border-white/10 bg-background/40 p-3">
                            <p className="text-white">{incident.title}</p>
                            <p className="text-xs text-muted">Status: {incident.status} | Owner: {incident.owner}</p>
                            <p className="text-xs text-muted">Created: {new Date(incident.created_at).toLocaleString()}</p>
                          </div>
                        ))}
                        {!userIncidents.length ? <p className="text-sm text-muted">No incidents found.</p> : null}
                      </div>
                    ) : null}

                    {userTab === "traffic" ? (
                      <div className="space-y-2 text-sm text-muted">
                        {userTraffic.map((record) => (
                          <div key={record.id} className="rounded-lg border border-white/10 bg-background/40 p-3">
                            <p className="text-white">{record.source_ip} → {record.destination_ip}</p>
                            <p className="text-xs text-muted">Protocol: {record.transport_protocol} | Class: {record.attack_class ?? "-"}</p>
                            <p className="text-xs text-muted">Risk: {record.risk_score ?? "-"} | Confidence: {record.confidence ?? "-"}</p>
                            <p className="text-xs text-muted">Created: {new Date(record.created_at).toLocaleString()}</p>
                          </div>
                        ))}
                        {!userTraffic.length ? <p className="text-sm text-muted">No traffic records found.</p> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <InputField
                  id="admin-edit-username"
                  label="Username"
                  value={editUsername}
                  onChange={setEditUsername}
                  placeholder="username"
                />
                <InputField
                  id="admin-edit-email"
                  label="Email"
                  value={editEmail}
                  onChange={setEditEmail}
                  placeholder="user@company.com"
                />
                <InputField
                  id="admin-edit-password"
                  label="Password"
                  type="password"
                  value={editPassword}
                  onChange={setEditPassword}
                  placeholder="Leave blank to keep"
                />
                <label className="block">
                  <span className="mb-2 block text-sm text-muted">Role</span>
                  <select
                    value={editRole}
                    onChange={(event) => setEditRole(event.target.value as "admin" | "customer")}
                    className="w-full rounded-xl border border-white/15 bg-[#0c152d]/80 px-3 py-3 text-sm text-text outline-none transition focus:border-brand/70 focus:ring-2 focus:ring-brand/20"
                  >
                    <option value="customer">customer</option>
                    <option value="admin">admin</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(event) => setEditActive(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/10 text-brand"
                  />
                  <span className="text-white">Active</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={editEmailVerified}
                    onChange={(event) => setEditEmailVerified(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/10 text-brand"
                  />
                  <span className="text-white">Email verified</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-muted md:col-span-2">
                  <input
                    type="checkbox"
                    checked={editAdminApproved}
                    onChange={(event) => setEditAdminApproved(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/10 text-brand"
                  />
                  <span className="text-white">Admin approved — user can sign in</span>
                </label>
              </div>
            )}

            {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

            {modalMode === "edit" ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={handleUpdateUser} loading={saving}>Save changes</Button>
                <Button variant="outline" onClick={closeUserModal}>Cancel</Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {reviewUser ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[1px]">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0c152d]/98 p-6 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-brand">Registration review</p>
                <h2 className="mt-2 text-xl font-semibold text-white">OT access request</h2>
                <p className="mt-1 text-sm text-muted">Validate organization profile and approve or reject platform access.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeReview}>Close</Button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={onboardingBadgeClass(reviewUser.onboarding_status)}>
                  {reviewUser.onboarding_status === "pending"
                    ? "Pending verification"
                    : reviewUser.onboarding_status === "approved"
                      ? "Approved"
                      : "Rejected"}
                </span>
                {reviewUser.is_email_verified ? (
                  <span className="rounded-md border border-sky-500/35 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-300">
                    Email verified
                  </span>
                ) : (
                  <span className="text-xs text-amber-300/90">Work email not verified by admin</span>
                )}
              </div>

              {reviewUser.role === "admin" ? (
                <p className="rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand">
                  This user is an administrator — onboarding approval does not apply.
                </p>
              ) : null}

              <div className="grid gap-3 text-sm md:grid-cols-2">
                {[
                  ["Full name", reviewUser.username],
                  ["Company", reviewUser.company_name ?? "—"],
                  ["Work email", reviewUser.email],
                  ["Job title", reviewUser.job_title ?? "—"],
                  ["Industry", formatIndustry(reviewUser.industry_type)],
                  ["Infrastructure", reviewUser.infrastructure_type ?? "—"],
                  ["Est. devices", reviewUser.estimated_device_count != null ? String(reviewUser.estimated_device_count) : "—"],
                  ["Country", reviewUser.country ?? "—"],
                  [
                    "Operates OT/ICS",
                    reviewUser.operates_ot_ics === true ? "Yes" : reviewUser.operates_ot_ics === false ? "No" : "—"
                  ],
                  ["Registered", new Date(reviewUser.created_at).toLocaleString()],
                  ["Role", reviewUser.role]
                ].map(([k, v]) => (
                  <div key={String(k)} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted">{k}</p>
                    <p className="mt-1 break-words text-white">{v}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted">Purpose of access</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{reviewUser.purpose_of_access ?? "—"}</p>
              </div>

              <div>
                <span className="mb-2 block text-xs text-muted">Rejection notice (optional — included in email)</span>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Infrastructure scope not supported, incomplete verification, ..."
                  className="w-full rounded-xl border border-white/15 bg-[#0c152d]/80 px-3 py-2 text-sm text-text outline-none focus:border-brand/60"
                />
              </div>

              {reviewError ? <p className="text-sm text-danger">{reviewError}</p> : null}

              <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
                {!reviewUser.is_email_verified ? (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={saving}
                    onClick={async () => {
                      setSaving(true);
                      setReviewError("");
                      try {
                        await updateUser(reviewUser.id, { is_email_verified: true });
                        const f = await fetchUser(reviewUser.id);
                        setReviewUser(f);
                        await loadUsers(query.trim() || undefined);
                      } catch (err) {
                        setReviewError(err instanceof Error ? err.message : "Unable to verify email.");
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Mark work email verified
                  </Button>
                ) : null}
                {reviewUser.role !== "admin" ? (
                  <>
                    <Button
                      size="sm"
                      loading={saving}
                      disabled={reviewUser.onboarding_status === "approved"}
                      onClick={async () => {
                        setSaving(true);
                        setReviewError("");
                        try {
                          await approveOnboardingRegistration(reviewUser.id);
                          await loadUsers(query.trim() || undefined);
                          closeReview();
                        } catch (err) {
                          setReviewError(err instanceof Error ? err.message : "Unable to approve.");
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="!border-red-500/50 !text-red-300 hover:!bg-red-500/10"
                      loading={saving}
                      disabled={reviewUser.onboarding_status === "rejected"}
                      onClick={async () => {
                        const ok = window.confirm("Reject this registration? The user cannot sign in.");
                        if (!ok) return;
                        setSaving(true);
                        setReviewError("");
                        try {
                          await rejectOnboardingRegistration(reviewUser.id, rejectReason.trim() || undefined);
                          await loadUsers(query.trim() || undefined);
                          closeReview();
                        } catch (err) {
                          setReviewError(err instanceof Error ? err.message : "Unable to reject.");
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      Reject
                    </Button>
                  </>
                ) : null}
                <Button variant="ghost" size="sm" onClick={closeReview}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
