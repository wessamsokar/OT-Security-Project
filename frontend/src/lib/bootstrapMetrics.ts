/**
 * Performance instrumentation for auth bootstrap and startup timing.
 * Tracks critical path durations and exposes metrics for debugging.
 */

type BootstrapPhase = 
  | "csrf_fetch"
  | "auth_me"
  | "tenant_fetch"
  | "runtime_integrity_start"
  | "dashboard_hydration"
  | "sse_connect"
  | "topology_load";

interface PhaseTiming {
  phase: BootstrapPhase;
  startTime: number;
  endTime?: number;
  duration?: number;
  success?: boolean;
  error?: string;
}

class BootstrapMetrics {
  private phases: Map<BootstrapPhase, PhaseTiming> = new Map();
  private bootstrapStart: number = 0;
  private bootstrapEnd: number = 0;
  private enabled: boolean = false;

  constructor() {
    this.enabled = import.meta.env.DEV || import.meta.env.VITE_DEBUG_BOOTSTRAP === "true";
  }

  startBootstrap() {
    this.bootstrapStart = performance.now();
    this.phases.clear();
    if (this.enabled) {
      console.log("[Bootstrap] Starting bootstrap sequence");
    }
  }

  startPhase(phase: BootstrapPhase): void {
    if (!this.enabled) return;
    this.phases.set(phase, {
      phase,
      startTime: performance.now()
    });
  }

  endPhase(phase: BootstrapPhase, success: boolean = true, error?: string): void {
    if (!this.enabled) return;
    const timing = this.phases.get(phase);
    if (!timing) return;

    timing.endTime = performance.now();
    timing.duration = timing.endTime - timing.startTime;
    timing.success = success;
    timing.error = error;

    const status = success ? "✓" : "✗";
    const durationStr = timing.duration.toFixed(0);
    console.log(`[Bootstrap] ${status} ${phase}: ${durationStr}ms${error ? ` (${error})` : ""}`);
  }

  endBootstrap() {
    this.bootstrapEnd = performance.now();
    if (this.enabled) {
      const totalDuration = this.bootstrapEnd - this.bootstrapStart;
      console.log(`[Bootstrap] Complete: ${totalDuration.toFixed(0)}ms total`);
      
      // Log phase breakdown
      const breakdown = Array.from(this.phases.values())
        .filter(p => p.duration !== undefined)
        .sort((a, b) => (b.duration || 0) - (a.duration || 0));
      
      if (breakdown.length > 0) {
        console.log("[Bootstrap] Phase breakdown (slowest first):");
        breakdown.forEach(p => {
          console.log(`  ${p.phase}: ${p.duration?.toFixed(0)}ms`);
        });
      }
    }
  }

  getMetrics(): Record<string, string> {
    const totalDuration = this.bootstrapEnd - this.bootstrapStart;
    const metrics: Record<string, string> = {
      total_bootstrap_ms: totalDuration.toFixed(0)
    };

    this.phases.forEach((timing, phase) => {
      metrics[`${phase}_ms`] = timing.duration?.toFixed(0) ?? "pending";
      metrics[`${phase}_success`] = timing.success ? "true" : "false";
    });

    return metrics;
  }

  getSlowPhases(thresholdMs: number = 1000): BootstrapPhase[] {
    return Array.from(this.phases.values())
      .filter(p => p.duration !== undefined && p.duration > thresholdMs)
      .map(p => p.phase);
  }
}

// Singleton instance
export const bootstrapMetrics = new BootstrapMetrics();
