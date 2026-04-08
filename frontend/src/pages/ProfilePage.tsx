import { getAuthSession } from "../lib/authSession";

export function ProfilePage() {
  const session = getAuthSession();
  const fullName = session?.user.fullName?.trim() || "OT Analyst";
  const email = session?.user.email || "unknown@ics-guard.local";
  const userId = session?.user.id || "N/A";

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.16em] text-brand">Profile</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">My Profile</h1>
        <p className="mt-1 text-sm text-muted">Account details for the currently authenticated ICS-Guard user.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Full Name</p>
          <p className="mt-2 text-lg font-medium text-white">{fullName}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Email</p>
          <p className="mt-2 text-lg font-medium text-white">{email}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-muted">User ID</p>
          <p className="mt-2 text-lg font-medium text-white">{userId}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Role</p>
          <p className="mt-2 text-lg font-medium text-white">Security Analyst</p>
        </div>
      </div>
    </section>
  );
}
