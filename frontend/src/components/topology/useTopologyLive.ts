import { useEffect, useState } from "react";

import { fetchTopologySnapshot } from "../../api/topologyApi";
import { connectTopologyStream } from "../../api/streamApi";

import { useTopologyStore } from "./topologyStore";

export function useTopologyLive(tenantId?: number, options?: { enabled?: boolean }) {
  const { applySnapshot, setLiveConnected } = useTopologyStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (!enabled) {
        setLoading(false);
        return;
      }
      try {
        const snapshot = await fetchTopologySnapshot(tenantId);
        if (!active) return;
        applySnapshot(snapshot);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load topology.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, [applySnapshot, tenantId, enabled]);

  useEffect(() => {
    if (!enabled) {
      return () => undefined;
    }
    const source = connectTopologyStream(
      (batch) => {
        applySnapshot(batch);
        setLiveConnected(true);
        setError("");
      },
      () => setLiveConnected(false),
      tenantId,
      { lazy: true, visibilityAware: true }
    );

    return () => {
      source?.close();
      setLiveConnected(false);
    };
  }, [applySnapshot, setLiveConnected, tenantId, enabled]);

  return { loading, error };
}
