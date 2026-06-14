import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { updateProfile } from "../api/authApi";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";
import { Edit2, Shield, User, Settings, Building } from "lucide-react";
import type { UserRole } from "../types/auth";

export function SettingsPrivacyPage() {
  const { user, refresh, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "preferences" | "workspace" | "admin">("profile");

  // Profile State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Preferences State
  const [emailAlerts, setEmailAlerts] = useState(user?.emailAlertsEnabled ?? false);
  const [landingPage, setLandingPage] = useState(user?.defaultLandingPage ?? "dashboard");
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  const roleLabels: Record<UserRole, string> = {
    admin: "Administrator",
    customer: "Customer",
    analyst: "Analyst",
    viewer: "Viewer"
  };

  const role = user?.role ?? "customer";
  const roleLabel = roleLabels[role] ?? "Customer";

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setProfileError("");
    try {
      await updateProfile({ full_name: editNameValue });
      await refresh();
      setIsEditingName(false);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePreferences = async () => {
    setIsSavingPrefs(true);
    try {
      await updateProfile({
        email_alerts_enabled: emailAlerts,
        default_landing_page: landingPage
      });
      await refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingPrefs(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-sm text-muted">Manage your personal preferences, workspace, and security.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 flex-shrink-0 space-y-1">
          <button
            onClick={() => setActiveTab("profile")}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition ${
              activeTab === "profile" ? "bg-white/10 text-white" : "text-muted hover:bg-white/5 hover:text-white"
            }`}
          >
            <User size={18} />
            Profile
          </button>
          
          <button
            onClick={() => setActiveTab("preferences")}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition ${
              activeTab === "preferences" ? "bg-white/10 text-white" : "text-muted hover:bg-white/5 hover:text-white"
            }`}
          >
            <Settings size={18} />
            Preferences
          </button>

          {["admin", "customer"].includes(role) && (
            <button
              onClick={() => setActiveTab("workspace")}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition ${
                activeTab === "workspace" ? "bg-white/10 text-white" : "text-muted hover:bg-white/5 hover:text-white"
              }`}
            >
              <Building size={18} />
              Workspace
            </button>
          )}

          {role === "admin" && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition ${
                activeTab === "admin" ? "bg-white/10 text-brand" : "text-brand/70 hover:bg-white/5 hover:text-brand"
              }`}
            >
              <Shield size={18} />
              Administration
            </button>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1">
          <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
            
            {/* TAB 1: PROFILE */}
            {activeTab === "profile" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h2 className="text-lg font-medium text-white border-b border-white/10 pb-4 mb-6">Personal Profile</h2>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs uppercase tracking-wide text-muted">Full Name</label>
                      {!isEditingName && (
                        <button
                          onClick={() => {
                            setEditNameValue(user?.fullName || "");
                            setProfileError("");
                            setIsEditingName(true);
                          }}
                          className="text-brand hover:text-brand-light transition"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                    </div>
                    
                    {isEditingName ? (
                      <div className="space-y-3">
                        <InputField
                          id="edit-fullname"
                          label=""
                          value={editNameValue}
                          onChange={setEditNameValue}
                          placeholder="Enter full name"
                          compact
                        />
                        {profileError && <p className="text-xs text-danger">{profileError}</p>}
                        <div className="flex gap-2">
                          <Button size="sm" loading={isSavingProfile} onClick={handleSaveProfile}>Save</Button>
                          <Button size="sm" variant="outline" disabled={isSavingProfile} onClick={() => setIsEditingName(false)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-white">{user?.fullName || "Not provided"}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-wide text-muted block mb-1">Email Address</label>
                    <p className="text-white">{user?.email}</p>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-wide text-muted block mb-1">Role</label>
                    <p className="text-white">{roleLabel}</p>
                  </div>

                  {role === "customer" && (
                    <div className="pt-4 border-t border-white/10 space-y-6">
                      <h3 className="text-sm font-medium text-white mb-4">Organization Details</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-xs uppercase tracking-wide text-muted block mb-1">Company Name</label>
                          <p className="text-white">{user?.companyName || "N/A"}</p>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-wide text-muted block mb-1">Industry</label>
                          <p className="text-white">{user?.industryType || "N/A"}</p>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-wide text-muted block mb-1">Infrastructure</label>
                          <p className="text-white">{user?.infrastructureType || "N/A"}</p>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-wide text-muted block mb-1">Est. Devices</label>
                          <p className="text-white">{user?.estimatedDeviceCount || "N/A"}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: PREFERENCES */}
            {activeTab === "preferences" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h2 className="text-lg font-medium text-white border-b border-white/10 pb-4 mb-6">User Preferences</h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-white">Email Alerts</h3>
                      <p className="text-xs text-muted mt-1">Receive email notifications for critical threat alerts.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEmailAlerts(!emailAlerts)}
                      className={[
                        "relative inline-flex h-6 w-11 items-center rounded-full transition",
                        emailAlerts ? "bg-brand/70" : "bg-white/20"
                      ].join(" ")}
                    >
                      <span className={["inline-block h-4 w-4 transform rounded-full bg-white transition", emailAlerts ? "translate-x-6" : "translate-x-1"].join(" ")} />
                    </button>
                  </div>

                  <div className="border-t border-white/10 pt-6">
                    <label className="text-sm font-medium text-white block mb-1">Default Landing Page</label>
                    <p className="text-xs text-muted mb-3">Choose which page loads when you sign in.</p>
                    <select
                      value={landingPage}
                      onChange={(e) => setLandingPage(e.target.value)}
                      className="w-full md:w-64 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    >
                      <option value="dashboard">Dashboard</option>
                      <option value="alerts">Alerts Page</option>
                      {hasPermission("view_soc_health") && <option value="soc-health">SOC Health</option>}
                    </select>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button loading={isSavingPrefs} onClick={handleSavePreferences}>Save Preferences</Button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: WORKSPACE */}
            {activeTab === "workspace" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h2 className="text-lg font-medium text-white border-b border-white/10 pb-4 mb-6">Workspace Details</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-muted block mb-1">Tenant Name</label>
                    <p className="text-white">{user?.companyName || "Global / Provider"}</p>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-wide text-muted block mb-1">Target SLA (Resolution Time)</label>
                    <p className="text-white">60 Minutes</p>
                    <p className="text-xs text-muted mt-1">This is a global default. Tenant-specific overrides are coming soon.</p>
                  </div>

                  <div className="border-t border-white/10 pt-6">
                    <p className="text-sm text-muted">Advanced tenant settings and environment management are restricted to Global Administrators.</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: ADMINISTRATION */}
            {activeTab === "admin" && role === "admin" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h2 className="text-lg font-medium text-brand border-b border-white/10 pb-4 mb-6">Security & Administration</h2>
                
                <div className="space-y-4">
                  <Link
                    to="/dashboard/users"
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white transition hover:bg-white/10 w-full"
                  >
                    <div>
                      <p className="font-medium">User Management</p>
                      <p className="text-xs text-muted mt-0.5">Approve and manage operator accounts</p>
                    </div>
                    <span>&rarr;</span>
                  </Link>

                  <Link
                    to="/dashboard/admin/roles"
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white transition hover:bg-white/10 w-full"
                  >
                    <div>
                      <p className="font-medium">Role-Based Access Control</p>
                      <p className="text-xs text-muted mt-0.5">Configure custom roles and permissions</p>
                    </div>
                    <span>&rarr;</span>
                  </Link>

                  <Link
                    to="/dashboard/ml-confidence"
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white transition hover:bg-white/10 w-full"
                  >
                    <div>
                      <p className="font-medium">ML Engine Metrics</p>
                      <p className="text-xs text-muted mt-0.5">View diagnostic ML metrics and confidence scores</p>
                    </div>
                    <span>&rarr;</span>
                  </Link>
                </div>
              </div>
            )}

          </section>
        </div>
      </div>
    </div>
  );
}
