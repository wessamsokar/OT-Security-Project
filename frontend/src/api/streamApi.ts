import { getAuthSession } from "../lib/authSession";

import type { AlertResponse, DashboardSummary } from "./alertsApi";

export type AlertsStreamSnapshot = {
  alerts: AlertResponse[];
  dashboard: DashboardSummary;
  ml_confidence: number;
  timestamp: string;
};

function buildStreamUrl(token: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");
  return `${base}/v1/stream/alerts?token=${encodeURIComponent(token)}`;
}

export function connectAlertsStream(onSnapshot: (snapshot: AlertsStreamSnapshot) => void, onError?: () => void): EventSource | null {
  const token = getAuthSession()?.token;
  if (!token) {
    return null;
  }

  const eventSource = new EventSource(buildStreamUrl(token));
  let connectedOnce = false;

  eventSource.onopen = () => {
    connectedOnce = true;
  };

  eventSource.addEventListener("snapshot", (event) => {
    try {
      const payload = JSON.parse((event as MessageEvent).data) as AlertsStreamSnapshot;
      onSnapshot(payload);
    } catch {
      onError?.();
    }
  });

  eventSource.onerror = () => {
    if (connectedOnce) {
      onError?.();
    }
  };

  return eventSource;
}
