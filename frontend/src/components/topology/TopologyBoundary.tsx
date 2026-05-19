import { Component, type ErrorInfo, type ReactNode } from "react";

import { securityDebug } from "../../lib/securityDebug";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class TopologyBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    securityDebug("topology", "render crash", {
      message: error.message,
      componentStack: info.componentStack
    });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
          <p className="text-xs uppercase tracking-[0.16em] text-amber-200">Topology degraded</p>
          <p className="mt-2 text-white">Topology rendering failed. Live data will keep syncing.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
