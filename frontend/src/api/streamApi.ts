import type { AlertResponse, DashboardSummary } from "./alertsApi";
import type { TopologySnapshot } from "./topologyApi";

export type AlertsStreamSnapshot = {
  alerts: AlertResponse[];
  dashboard: DashboardSummary;
  ml_confidence: number;
  timestamp: string;
};

const SSE_CONNECT_TIMEOUT_MS = 20000;
const SSE_BACKOFF_BASE_MS = 1500;
const SSE_BACKOFF_MAX_MS = 60000;

type StreamHandle = {
  close: () => void;
};

type StreamOptions = {
  lazy?: boolean;
  visibilityAware?: boolean;
};

type StreamConnectParams<T> = {
  url: string;
  eventName: string;
  onMessage: (payload: T) => void;
  onError?: () => void;
  visibilityAware?: boolean;
};

function createStreamController<T>({ url, eventName, onMessage, onError, visibilityAware }: StreamConnectParams<T>): StreamHandle {
  let source: EventSource | null = null;
  let reconnectAttempts = 0;
  let connectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimerId: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let connectedOnce = false;

  const cleanupTimers = () => {
    if (connectTimeoutId) {
      clearTimeout(connectTimeoutId);
      connectTimeoutId = null;
    }
    if (reconnectTimerId) {
      clearTimeout(reconnectTimerId);
      reconnectTimerId = null;
    }
  };

  const attachSource = () => {
    if (closed) return;

    source = new EventSource(url, { withCredentials: true });

    connectTimeoutId = setTimeout(() => {
      if (!connectedOnce && source) {
        console.warn(`[SSE] ${eventName} stream connection timed out after ${SSE_CONNECT_TIMEOUT_MS}ms`);
        source.close();
        source = null;
        onError?.();
        const backoffMs = Math.min(
          SSE_BACKOFF_BASE_MS * Math.pow(2, reconnectAttempts),
          SSE_BACKOFF_MAX_MS
        );
        reconnectAttempts += 1;
        reconnectTimerId = setTimeout(() => {
          attachSource();
        }, backoffMs);
      }
    }, SSE_CONNECT_TIMEOUT_MS);

    source.onopen = () => {
      cleanupTimers();
      connectedOnce = true;
      reconnectAttempts = 0;
      console.debug(`[SSE] ${eventName} stream connected`);
    };

    source.addEventListener(eventName, (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as T;
        onMessage(payload);
      } catch {
        onError?.();
      }
    });

    source.onerror = () => {
      cleanupTimers();
      if (closed) return;
      if (source) {
        source.close();
        source = null;
      }
      if (visibilityAware && document.visibilityState === "hidden") {
        console.debug(`[SSE] ${eventName} stream paused (tab hidden)`);
        return;
      }

      const backoffMs = Math.min(
        SSE_BACKOFF_BASE_MS * Math.pow(2, reconnectAttempts),
        SSE_BACKOFF_MAX_MS
      );
      reconnectAttempts += 1;
      console.warn(`[SSE] ${eventName} stream disconnected, reconnecting in ${backoffMs}ms (attempt ${reconnectAttempts})`);
      reconnectTimerId = setTimeout(() => {
        attachSource();
      }, backoffMs);
      onError?.();
    };
  };

  const handleVisibilityChange = () => {
    if (!visibilityAware) return;
    if (document.visibilityState === "hidden") {
      if (source) {
        source.close();
      }
      cleanupTimers();
    } else if (!closed && !source) {
      attachSource();
    }
  };

  if (visibilityAware) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  attachSource();

  return {
    close: () => {
      closed = true;
      cleanupTimers();
      if (visibilityAware) {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      if (source) {
        source.close();
      }
      source = null;
    }
  };
}

function buildStreamUrl(tenantId?: number): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");
  let url = `${base}/v1/stream/alerts`;
  if (tenantId) url += `?tenant_id=${tenantId}`;
  return url;
}

export function connectAlertsStream(
  onSnapshot: (snapshot: AlertsStreamSnapshot) => void,
  onError?: () => void,
  tenantId?: number,
  options?: StreamOptions
): StreamHandle | null {
  const url = buildStreamUrl(tenantId);
  const attach = () =>
    createStreamController<AlertsStreamSnapshot>({
      url,
      eventName: "snapshot",
      onMessage: onSnapshot,
      onError,
      visibilityAware: options?.visibilityAware
    });

  if (options?.lazy) {
    const handle: StreamHandle = {
      close: () => undefined
    };
    const timer = setTimeout(() => {
      const controller = attach();
      handle.close = controller.close;
    }, 500);
    const originalClose = handle.close;
    handle.close = () => {
      clearTimeout(timer);
      originalClose();
    };
    return handle;
  }

  return attach();
}

function buildTopologyStreamUrl(tenantId?: number): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");
  let url = `${base}/v1/stream/topology`;
  if (tenantId) url += `?tenant_id=${tenantId}`;
  return url;
}

export function connectTopologyStream(
  onBatch: (snapshot: TopologySnapshot) => void,
  onError?: () => void,
  tenantId?: number,
  options?: StreamOptions
): StreamHandle | null {
  const url = buildTopologyStreamUrl(tenantId);
  const attach = () =>
    createStreamController<TopologySnapshot>({
      url,
      eventName: "topology_batch",
      onMessage: onBatch,
      onError,
      visibilityAware: options?.visibilityAware
    });

  if (options?.lazy) {
    const handle: StreamHandle = {
      close: () => undefined
    };
    const timer = setTimeout(() => {
      const controller = attach();
      handle.close = controller.close;
    }, 500);
    const originalClose = handle.close;
    handle.close = () => {
      clearTimeout(timer);
      originalClose();
    };
    return handle;
  }

  return attach();
}
