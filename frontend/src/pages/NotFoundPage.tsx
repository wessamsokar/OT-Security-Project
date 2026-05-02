import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-panel/45 p-6 text-text shadow-panel">
      <p className="text-xs uppercase tracking-[0.16em] text-brand">Not Found</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">This page is unavailable</h1>
      <p className="mt-2 text-sm text-muted">
        The page you tried to access does not exist or you do not have permission to view it.
      </p>
      <Link
        to="/dashboard"
        className="mt-5 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
      >
        Back to dashboard
      </Link>
    </section>
  );
}
