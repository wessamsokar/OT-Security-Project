import { Component, type ErrorInfo, type ReactNode } from "react";

import { securityDebug } from "../lib/securityDebug";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
  details?: {
    id: string;
    message: string;
    stack?: string;
    componentStack?: string;
    path?: string;
    occurredAt: string;
  };
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const occurredAt = new Date().toISOString();
    const id = `${occurredAt}-${Math.random().toString(36).slice(2, 8)}`;
    const details = {
      id,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
      occurredAt
    };

    securityDebug("react-error-boundary", "caught render error", {
      message: error.message,
      componentStack: info.componentStack
    });

    try {
      sessionStorage.setItem("ot_last_render_error", JSON.stringify(details));
    } catch {
      // Ignore storage failures to avoid masking the original error.
    }

    this.setState({ details });
  }

  render() {
    if (this.state.error) {
      const debugEnabled =
        (typeof window !== "undefined" && window.localStorage.getItem("ot_security_debug") === "true") ||
        import.meta.env.DEV;

      return (
        <div className="mx-auto mt-28 max-w-xl rounded-3xl border border-red-500/30 bg-panel/80 p-6 text-text shadow-panel">
          <p className="text-xs uppercase tracking-[0.16em] text-red-300">Runtime recovery</p>
          <h1 className="mt-2 text-xl font-semibold text-white">The interface recovered from an error</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            A page failed to render safely. Your session has not been trusted with any new permissions; try reloading
            the page. If this repeats, contact your OT security administrator.
          </p>
          {debugEnabled && this.state.details ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-muted">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Error details</p>
              <p className="mt-2 text-white">{this.state.details.message || "Unknown render error"}</p>
              {this.state.details.path ? (
                <p className="mt-1">Path: {this.state.details.path}</p>
              ) : null}
              <p className="mt-1">Error ID: {this.state.details.id}</p>
            </div>
          ) : null}
          <button
            type="button"
            className="mt-5 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
            onClick={() => {
              this.setState({ error: null });
              window.location.assign("/dashboard");
            }}
          >
            Return to dashboard
          </button>
          <button
            type="button"
            className="ml-3 mt-5 rounded-xl border border-white/10 bg-transparent px-4 py-2 text-sm text-muted transition hover:bg-white/10 hover:text-white"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
