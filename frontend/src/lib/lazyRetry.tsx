import { lazy, type ComponentType } from "react";

type LazyRetryOptions = {
  retryKey: string;
};

function shouldReloadForError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("failed to fetch dynamically imported module") ||
    lower.includes("chunkloaderror") ||
    lower.includes("loading chunk");
}

function LazyImportError({ message }: { message: string }) {
  return (
    <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-white/10 bg-panel/60 p-6 text-sm text-muted shadow-panel">
      <p className="text-xs uppercase tracking-[0.16em] text-amber-200">Module load error</p>
      <p className="mt-2 text-base text-white">We could not load this screen.</p>
      <p className="mt-2 text-xs text-muted">{message || "Unknown error"}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
        <button
          type="button"
          className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-xs font-semibold text-muted transition hover:text-white"
          onClick={() => window.location.assign("/dashboard")}
        >
          Return to dashboard
        </button>
      </div>
    </div>
  );
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  options: LazyRetryOptions
) {
  return lazy(async () => {
    try {
      const module = await importer();
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`ics_lazy_retry_${options.retryKey}`);
      }
      return module;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (typeof window !== "undefined" && shouldReloadForError(message)) {
        const key = `ics_lazy_retry_${options.retryKey}`;
        const alreadyRetried = sessionStorage.getItem(key) === "true";
        if (!alreadyRetried) {
          sessionStorage.setItem(key, "true");
          window.location.reload();
        }
      }
      return { default: () => <LazyImportError message={message} /> };
    }
  });
}
