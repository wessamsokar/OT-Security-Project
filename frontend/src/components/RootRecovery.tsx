import { Component, type ErrorInfo, type ReactNode } from "react";

import { securityDebug } from "../lib/securityDebug";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
  message?: string;
  source?: string;
};

function clearLocalSession(): void {
  if (typeof window === "undefined") return;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      if (key.startsWith("ics_") || key.startsWith("ot_")) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore cleanup errors to keep recovery UI responsive.
  }
}

export class RootRecovery extends Component<Props, State> {
  state: State = { error: null };

  componentDidMount(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("error", this.handleWindowError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentWillUnmount(): void {
    if (typeof window === "undefined") return;

    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    securityDebug("root-recovery", "fatal render error", {
      message: error.message,
      componentStack: info.componentStack
    });
    this.setState({ message: error.message, source: "render" });
  }

  handleWindowError = (event: ErrorEvent): void => {
    const message = event?.error?.message || event.message || "Uncaught runtime error";
    this.setState({ error: event.error ?? new Error(message), message, source: "window" });
  };

  handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason ?? "Unhandled rejection");
    this.setState({ error: reason instanceof Error ? reason : new Error(message), message, source: "promise" });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto mt-20 max-w-2xl rounded-3xl border border-red-500/30 bg-panel/80 p-6 text-text shadow-panel">
          <p className="text-xs uppercase tracking-[0.16em] text-red-300">Emergency recovery</p>
          <h1 className="mt-2 text-xl font-semibold text-white">The console hit a fatal error</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            A critical error prevented the interface from rendering. You can reload, clear the local session,
            or return to login.
          </p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-muted">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Error snapshot</p>
            <p className="mt-2 text-white">{this.state.message ?? "Unknown fatal error"}</p>
            {this.state.source ? <p className="mt-1">Source: {this.state.source}</p> : null}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
              onClick={() => window.location.reload()}
            >
              Reload app
            </button>
            <button
              type="button"
              className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-xs font-semibold text-muted transition hover:text-white"
              onClick={() => {
                clearLocalSession();
                window.location.assign("/login");
              }}
            >
              Clear session
            </button>
            <button
              type="button"
              className="rounded-full border border-brand/40 bg-brand/15 px-4 py-2 text-xs font-semibold text-brand transition hover:bg-brand/25"
              onClick={() => window.location.assign("/login")}
            >
              Go to login
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
