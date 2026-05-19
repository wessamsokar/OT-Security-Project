import type { ClientSecurityAction, ClientSecurityEvent } from "../api/securityApi";
import { securityDebug } from "./securityDebug";

type Signal = {
  id: string;
  score: number;
  action: ClientSecurityAction;
  reason: string;
  confidence: "weak" | "medium" | "high";
  metadata?: Record<string, string | number | boolean | null>;
};

type RuntimeIntegrityOptions = {
  intervalMs?: number;
  telemetryScore?: number;
  criticalCooldownMs?: number;
  onTelemetry: (event: ClientSecurityEvent) => void | Promise<void>;
  onCritical: (event: ClientSecurityEvent) => void | Promise<void>;
};

type Snapshot = {
  fetch: typeof window.fetch;
  xhrOpen: typeof XMLHttpRequest.prototype.open;
  xhrSend: typeof XMLHttpRequest.prototype.send;
  consoleError: typeof console.error;
  consoleWarn: typeof console.warn;
  objectDefineProperty: typeof Object.defineProperty;
  arrayPush: typeof Array.prototype.push;
  reactDevToolsHook?: {
    inject?: unknown;
    onCommitFiberRoot?: unknown;
    onCommitFiberUnmount?: unknown;
  };
};

const DEFAULT_INTERVAL_MS = 12_000;
const DEFAULT_TELEMETRY_SCORE = 35;
const DEFAULT_CRITICAL_COOLDOWN_MS = 60_000;
const LARGE_DEVTOOLS_DELTA = 180;

const snapshot: Snapshot | null =
  typeof window === "undefined"
    ? null
    : {
        fetch: window.fetch,
        xhrOpen: XMLHttpRequest.prototype.open,
        xhrSend: XMLHttpRequest.prototype.send,
        consoleError: console.error,
        consoleWarn: console.warn,
        objectDefineProperty: Object.defineProperty,
        arrayPush: Array.prototype.push,
        reactDevToolsHook: window.__REACT_DEVTOOLS_GLOBAL_HOOK__
          ? {
              inject: window.__REACT_DEVTOOLS_GLOBAL_HOOK__.inject,
              onCommitFiberRoot: window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot,
              onCommitFiberUnmount: window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberUnmount
            }
          : undefined
      };

function looksNative(fn: unknown): boolean {
  if (typeof fn !== "function") return false;
  return /\[native code\]/.test(Function.prototype.toString.call(fn));
}

function scriptSignals(): Signal[] {
  const nonce = window.__CSP_NONCE__;
  const signals: Signal[] = [];
  const scripts = Array.from(document.scripts);

  for (const script of scripts) {
    const src = script.getAttribute("src") ?? "";
    const scriptNonce = script.getAttribute("nonce") ?? "";
    const sameOriginSrc = !src || src.startsWith("/") || src.startsWith(window.location.origin);
    const viteDevClient = src.includes("/@vite/client");

    if (!sameOriginSrc && !viteDevClient) {
      signals.push({
        id: `external-script:${src.slice(0, 80)}`,
        score: 55,
        action: "tamper.detected",
        reason: "Unexpected external script in document",
        confidence: "high",
        metadata: { src: src.slice(0, 200) }
      });
    }

    if (!src && nonce && scriptNonce !== nonce) {
      signals.push({
        id: "inline-script-without-nonce",
        score: 80,
        action: "runtime.integrity.failure",
        reason: "Inline script missing CSP nonce",
        confidence: "high"
      });
    }
  }

  return signals;
}

function apiTamperSignals(): Signal[] {
  if (!snapshot) return [];
  const signals: Signal[] = [];

  if (window.fetch !== snapshot.fetch || !looksNative(window.fetch)) {
    signals.push({
      id: "fetch-modified",
      score: 25,
      action: "tamper.detected",
      reason: "window.fetch was modified",
      confidence: "medium"
    });
  }
  if (XMLHttpRequest.prototype.open !== snapshot.xhrOpen || XMLHttpRequest.prototype.send !== snapshot.xhrSend) {
    signals.push({
      id: "xhr-modified",
      score: 25,
      action: "tamper.detected",
      reason: "XMLHttpRequest prototype was modified",
      confidence: "medium"
    });
  }
  if (console.error !== snapshot.consoleError || console.warn !== snapshot.consoleWarn) {
    signals.push({
      id: "console-modified",
      score: 10,
      action: "devtools.detected",
      reason: "Console methods were modified",
      confidence: "weak"
    });
  }
  if (Object.defineProperty !== snapshot.objectDefineProperty || Array.prototype.push !== snapshot.arrayPush) {
    signals.push({
      id: "prototype-core-modified",
      score: 45,
      action: "runtime.integrity.failure",
      reason: "Core JavaScript prototype/function modified",
      confidence: "medium"
    });
  }

  return signals;
}

function devtoolsSignals(): Signal[] {
  const signals: Signal[] = [];
  const widthDelta = Math.abs(window.outerWidth - window.innerWidth);
  const heightDelta = Math.abs(window.outerHeight - window.innerHeight);

  if (widthDelta > LARGE_DEVTOOLS_DELTA || heightDelta > LARGE_DEVTOOLS_DELTA) {
    signals.push({
      id: "devtools-window-delta",
      score: 10,
      action: "devtools.detected",
      reason: "DevTools-sized viewport delta detected",
      confidence: "weak",
      metadata: { widthDelta, heightDelta }
    });
  }

  return signals;
}

function sessionStorageSignals(): Signal[] {
  const raw = sessionStorage.getItem("ot_runtime_security_warning");
  if (raw && raw.length > 4000) {
    return [
      {
        id: "security-warning-storage-tampered",
        score: 10,
        action: "tamper.detected",
        reason: "Security warning session storage was unexpectedly large",
        confidence: "weak"
      }
    ];
  }
  return [];
}

function reactHookSignals(): Signal[] {
  if (!snapshot) return [];
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const signals: Signal[] = [];

  if (!snapshot.reactDevToolsHook && hook) {
    signals.push({
      id: "react-devtools-hook-added",
      score: 10,
      action: "devtools.detected",
      reason: "React DevTools global hook appeared after startup",
      confidence: "weak"
    });
  }

  if (snapshot.reactDevToolsHook && hook) {
    const changed =
      hook.inject !== snapshot.reactDevToolsHook.inject ||
      hook.onCommitFiberRoot !== snapshot.reactDevToolsHook.onCommitFiberRoot ||
      hook.onCommitFiberUnmount !== snapshot.reactDevToolsHook.onCommitFiberUnmount;

    if (changed) {
      signals.push({
        id: "react-devtools-hook-modified",
        score: 20,
        action: "tamper.detected",
        reason: "React DevTools hook methods changed after startup",
        confidence: "weak"
      });
    }
  }

  const hookRenderers = hook?.renderers;
  if (hookRenderers && !(hookRenderers instanceof Map)) {
    signals.push({
      id: "react-renderers-shape-anomaly",
      score: 15,
      action: "tamper.detected",
      reason: "React DevTools renderers object has unexpected shape",
      confidence: "weak"
    });
  }

  return signals;
}

function summarize(signals: Signal[]): ClientSecurityEvent | null {
  if (!signals.length) return null;
  const score = Math.min(100, signals.reduce((sum, signal) => sum + signal.score, 0));
  const strongest = signals.reduce((max, signal) => (signal.score > max.score ? signal : max), signals[0]);
  const action: ClientSecurityAction =
    score >= 80 ? "runtime.integrity.failure" : strongest.action;
  const severity = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 35 ? "medium" : "low";

  return {
    action,
    severity,
    score,
    reason: strongest.reason,
    signals: signals.map((signal) => signal.id).slice(0, 25),
    metadata: signals.reduce<Record<string, string | number | boolean | null>>((acc, signal) => {
      if (signal.metadata) {
        for (const [key, value] of Object.entries(signal.metadata)) {
          acc[`${signal.id}.${key}`] = value;
        }
      }
      return acc;
    }, {})
  };
}

function shouldForceLogout(signals: Signal[], event: ClientSecurityEvent): boolean {
  const highConfidenceSignals = signals.filter((signal) => signal.confidence === "high");
  const highConfidenceIds = new Set(highConfidenceSignals.map((signal) => signal.id));

  // Only active script execution/injection evidence can immediately invalidate a session.
  if (highConfidenceIds.has("inline-script-without-nonce")) {
    return true;
  }

  // Extensions commonly add an external script and wrap APIs. Treat that as telemetry
  // unless there are two independent high-confidence script signals.
  const hasUnexpectedScript = Array.from(highConfidenceIds).some((id) => id.startsWith("external-script:"));
  if (hasUnexpectedScript && highConfidenceSignals.length >= 2) {
    return true;
  }

  // Medium-only signals are telemetry/warning. Extensions and observability tools often
  // wrap fetch/XHR/prototypes; do not invalidate sessions without script execution evidence.
  return false;
}

export function startRuntimeIntegrityMonitor(options: RuntimeIntegrityOptions): () => void {
  if (typeof window === "undefined" || !snapshot) return () => {};

  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const telemetryScore = options.telemetryScore ?? DEFAULT_TELEMETRY_SCORE;
  const criticalCooldownMs = options.criticalCooldownMs ?? DEFAULT_CRITICAL_COOLDOWN_MS;
  const reported = new Set<string>();
  let lastCriticalAt = 0;
  let stopped = false;

  const runCheck = async () => {
    if (stopped || document.visibilityState === "hidden") return;
    const signals = [
      ...apiTamperSignals(),
      ...scriptSignals(),
      ...devtoolsSignals(),
      ...reactHookSignals(),
      ...sessionStorageSignals()
    ];
    const event = summarize(signals);
    if (!event || event.score < telemetryScore) return;
    securityDebug("runtime-integrity", "signals collected", event);

    const key = `${event.action}:${event.signals.sort().join(",")}`;
    if (reported.has(key)) return;
    reported.add(key);

    const now = Date.now();
    if (shouldForceLogout(signals, event) && now - lastCriticalAt > criticalCooldownMs) {
      lastCriticalAt = now;
      securityDebug("runtime-integrity", "critical response selected", event);
      await options.onCritical(event);
      return;
    }
    securityDebug("runtime-integrity", "telemetry response selected", event);
    await options.onTelemetry(event);
  };

  const timer = window.setInterval(() => {
    void runCheck();
  }, intervalMs);
  void runCheck();

  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}
