import { useEffect, useMemo, useState } from "react";

import { fetchModelVersions, type ModelVersionResponse } from "../api/modelApi";
import { connectAlertsStream } from "../api/streamApi";

type FeatureWeight = {
  name: string;
  weight: number;
};

const CONFIDENCE_KEYS = ["confidence", "confidence_pct", "overall_confidence", "f1", "accuracy"];

function parseConfidence(metrics: Record<string, unknown>): number {
  for (const key of CONFIDENCE_KEYS) {
    const raw = metrics[key];
    if (typeof raw === "number") {
      return raw <= 1 ? raw * 100 : raw;
    }
  }
  return 0;
}

function parseFeatureWeights(metrics: Record<string, unknown>): FeatureWeight[] {
  const fromObject = metrics.feature_importance;
  if (fromObject && typeof fromObject === "object" && !Array.isArray(fromObject)) {
    return Object.entries(fromObject as Record<string, unknown>)
      .filter(([, value]) => typeof value === "number")
      .map(([name, value]) => ({ name, weight: value as number }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);
  }

  const fromArray = metrics.top_features;
  if (Array.isArray(fromArray)) {
    return fromArray
      .map((row) => {
        if (!row || typeof row !== "object") {
          return null;
        }
        const item = row as Record<string, unknown>;
        const name = typeof item.name === "string" ? item.name : typeof item.feature === "string" ? item.feature : null;
        const weight = typeof item.weight === "number" ? item.weight : typeof item.importance === "number" ? item.importance : null;
        if (!name || weight === null) {
          return null;
        }
        return { name, weight };
      })
      .filter((row): row is FeatureWeight => row !== null)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);
  }

  return [];
}

export function MlConfidencePage() {
  const [versions, setVersions] = useState<ModelVersionResponse[]>([]);
  const [liveConfidence, setLiveConfidence] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const rows = await fetchModelVersions();
        if (!active) return;
        setVersions(rows);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load model confidence right now.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    const stream = connectAlertsStream(
      (snapshot) => {
        if (!active) return;
        setLiveConfidence(snapshot.ml_confidence);
      },
      () => {
        if (!active) return;
        setError("Live stream disconnected. Showing latest model confidence.");
      }
    );

    return () => {
      active = false;
      stream?.close();
    };
  }, []);

  const activeVersion = useMemo(() => {
    return versions.find((version) => version.is_active) ?? versions[0] ?? null;
  }, [versions]);

  const metrics = activeVersion?.metrics_json ?? {};
  const confidence = liveConfidence ?? parseConfidence(metrics);
  const features = parseFeatureWeights(metrics);
  const normalizer = features.length
    ? Math.max(...features.map((feature) => (feature.weight > 1 ? feature.weight : feature.weight * 100)))
    : 1;

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.16em] text-brand">ML Page</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">ML Confidence</h1>
      <p className="mt-1 text-sm text-muted">Model confidence and explainability snapshot for operator decisions.</p>

      {loading ? <p className="mt-4 text-sm text-muted">Loading model confidence...</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <article className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <p className="text-xs text-emerald-200">Current Confidence</p>
        <p className="mt-2 text-3xl font-semibold text-white">{confidence.toFixed(1)}%</p>
        <p className="mt-2 text-xs text-emerald-100">
          Active Model: {activeVersion?.label ?? "N/A"} ({activeVersion?.version ?? "unknown"})
        </p>
      </article>

      <div className="mt-5 space-y-3">
        {features.map((feature) => (
          <div key={feature.name}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-white">{feature.name}</span>
              <span className="text-muted">{Math.round((feature.weight > 1 ? feature.weight : feature.weight * 100) * 10) / 10}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-brand"
                style={{
                  width: `${Math.max(
                    4,
                    Math.min(100, ((feature.weight > 1 ? feature.weight : feature.weight * 100) / normalizer) * 100)
                  )}%`
                }}
              />
            </div>
          </div>
        ))}
        {!loading && !features.length ? (
          <p className="text-sm text-muted">Feature importance is not available in current model metrics.</p>
        ) : null}
      </div>
    </section>
  );
}
