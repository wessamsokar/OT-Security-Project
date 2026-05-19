import axios from "axios";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import { apiClient } from "../api/client";
import { clearCsrfCache, ensureCsrfToken } from "../api/csrf";
import { logoutUser } from "../api/authApi";
import { reportClientSecurityEvent, type ClientSecurityEvent } from "../api/securityApi";
import { startRuntimeIntegrityMonitor } from "../lib/runtimeIntegrity";
import { securityDebug } from "../lib/securityDebug";
import { bootstrapMetrics } from "../lib/bootstrapMetrics";
import type { OnboardingStatus, PermissionCode, UserRole } from "../types/auth";

export type AuthUser = {
  id: string;
  email: string;
  fullName?: string;
  role: UserRole;
  onboardingStatus: OnboardingStatus;
  permissions: PermissionCode[];
};

type MeApi = {
  id: number;
  username: string;
  email: string;
  role: string;
  onboarding_status: string;
  permissions?: PermissionCode[];
};

type AuthContextValue = {
  user: AuthUser | null;
  authState: AuthSessionState;
  isLoading: boolean;
  isBooting: boolean;
  isRefreshing: boolean;
  isDegraded: boolean;
  isAuthenticated: boolean;
  bootstrapError: string | null;
  setUser: (user: AuthUser | null) => void;
  refresh: (options?: RefreshOptions) => Promise<boolean>;
  retryBootstrap: () => void;
  forceLogout: () => void;
  clearSession: () => void;
  hasPermission: (code: PermissionCode | PermissionCode[]) => boolean;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_HEARTBEAT_MS = 60_000;
const AUTH_BOOTSTRAP_TIMEOUT_MS = 12_000;
const AUTH_REQUEST_TIMEOUT_MS = 10_000;
const AUTH_CSRF_TIMEOUT_MS = 8_000;
const AUTH_CACHE_KEY = "ics_cached_user";
const AUTH_BOOTSTRAP_FLAG = "__ics_auth_bootstrap_once";

export type AuthSessionState =
  | "cold_boot"
  | "authenticated"
  | "background_refresh"
  | "degraded"
  | "expired"
  | "unauthenticated";

type RefreshOptions = {
  reason?: string;
  timeoutMs?: number;
  clearOnFail?: boolean;
  captureError?: boolean;
  silent?: boolean;
};

function normalizeOnboarding(raw: string | undefined | null): OnboardingStatus {
  const v = String(raw ?? "").toLowerCase();
  if (v === "pending" || v === "approved" || v === "rejected") {
    return v;
  }
  return "approved";
}

function normalizeRole(raw: string | undefined | null): UserRole {
  const v = String(raw ?? "").toLowerCase();
  if (v === "admin" || v === "customer" || v === "analyst" || v === "viewer") {
    return v;
  }
  return "customer";
}

function mapMe(data: MeApi): AuthUser {
  return {
    id: String(data.id),
    email: data.email,
    fullName: data.username,
    role: normalizeRole(data.role),
    onboardingStatus: normalizeOnboarding(data.onboarding_status),
    permissions: data.permissions ?? []
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(AUTH_CACHE_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [authState, setAuthState] = useState<AuthSessionState>(() => {
    if (typeof window === "undefined") return "cold_boot";
    return sessionStorage.getItem(AUTH_CACHE_KEY) ? "background_refresh" : "cold_boot";
  });
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const userRef = useRef<AuthUser | null>(null);
  const heartbeatInFlightRef = useRef(false);
  const identityMismatchCountRef = useRef(0);
  const bootstrapInFlightRef = useRef(false);
  const hasBootstrappedRef = useRef(false);
  const renderCountRef = useRef(0);
  const isLoading = authState === "cold_boot";
  const isBooting = authState === "cold_boot";
  const isRefreshing = authState === "background_refresh";
  const isDegraded = authState === "degraded";

  renderCountRef.current += 1;
  console.debug(`[provider] AuthProvider render ${renderCountRef.current}`);

  useEffect(() => {
    console.info("[provider] AuthProvider mounted");
    return () => {
      console.info("[provider] AuthProvider unmounted");
    };
  }, []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (user) {
      try {
        sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
      } catch {
        // Ignore storage failures to avoid breaking auth flow.
      }
    } else {
      sessionStorage.removeItem(AUTH_CACHE_KEY);
    }
  }, [user]);

  const clearSession = useCallback(() => {
    securityDebug("auth", "clearSession");
    setUser(null);
    setAuthState("unauthenticated");
    clearCsrfCache();
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(AUTH_CACHE_KEY);
      (window as any)[AUTH_BOOTSTRAP_FLAG] = false;
    }
  }, []);

  const forceLogout = useCallback(() => {
    securityDebug("auth", "forceLogout");
    clearSession();
    setBootstrapError(null);
    setAuthState("unauthenticated");
  }, [clearSession]);

  const refresh = useCallback(async (options?: RefreshOptions): Promise<boolean> => {
    const {
      reason = "refresh",
      timeoutMs = AUTH_REQUEST_TIMEOUT_MS,
      clearOnFail = false,
      captureError = false,
      silent = false
    } = options ?? {};
    if (!silent) {
      securityDebug("auth", "refresh started", { reason, timeoutMs });
    }
    try {
      const { data } = await apiClient.get<MeApi>("/v1/auth/me", { timeout: timeoutMs });
      const next = mapMe(data);
      securityDebug("auth", "refresh succeeded", { userId: next.id, role: next.role });
      setUser(next);
      setAuthState("authenticated");
      if (captureError) {
        setBootstrapError(null);
      }
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        securityDebug("auth", "refresh got 401");
        clearSession();
        setAuthState(userRef.current ? "expired" : "unauthenticated");
        if (captureError) {
          setBootstrapError("Session expired. Please sign in again.");
        }
        return false;
      }
      const message = axios.isAxiosError(error) ? error.message || "Request failed" : "Request failed";
      securityDebug("auth", "refresh failed", { reason, message });
      if (clearOnFail) {
        clearSession();
      }
      if (captureError) {
        setBootstrapError(message);
      }
        if (userRef.current) {
          setAuthState("degraded");
        }
      return false;
    }
  }, [clearSession]);

  const runBootstrap = useCallback(
    async (reason: string) => {
      if (bootstrapInFlightRef.current) return;
      if (reason === "bootstrap" && hasBootstrappedRef.current) {
        securityDebug("auth", "bootstrap skipped (already ran)");
        return;
      }
      if (reason === "bootstrap" && typeof window !== "undefined") {
        if ((window as any)[AUTH_BOOTSTRAP_FLAG]) {
          securityDebug("auth", "bootstrap skipped (global guard)");
          return;
        }
        (window as any)[AUTH_BOOTSTRAP_FLAG] = true;
      }
      if (reason === "bootstrap") {
        hasBootstrappedRef.current = true;
      }
      bootstrapInFlightRef.current = true;
      let didTimeout = false;
      const hadCachedUser = Boolean(userRef.current);
      const bootstrapStart = performance.now();
      
      bootstrapMetrics.startBootstrap();
      console.groupCollapsed("[startup] auth bootstrap");
      console.time("startup:auth_bootstrap");
      
      const timeoutId = window.setTimeout(() => {
        didTimeout = true;
        setBootstrapError("Auth bootstrap timed out. Check your network or try again.");
        setAuthState(hadCachedUser ? "degraded" : "unauthenticated");
        securityDebug("auth", "bootstrap timed out", { reason });
        bootstrapMetrics.endBootstrap();
      }, AUTH_BOOTSTRAP_TIMEOUT_MS);

      setAuthState(hadCachedUser ? "background_refresh" : "cold_boot");
      setBootstrapError(null);
      securityDebug("auth", "bootstrap started", { reason });
      
      // CSRF fetch with instrumentation
      try {
        bootstrapMetrics.startPhase("csrf_fetch");
        await ensureCsrfToken({ timeoutMs: AUTH_CSRF_TIMEOUT_MS });
        bootstrapMetrics.endPhase("csrf_fetch", true);
      } catch (error) {
        bootstrapMetrics.endPhase("csrf_fetch", false, error instanceof Error ? error.message : "unknown");
        securityDebug("auth", "csrf bootstrap failed", { reason, message: String(error) });
      }

      // /auth/me fetch with instrumentation
      bootstrapMetrics.startPhase("auth_me");
      const ok = await refresh({
        reason,
        timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
        clearOnFail: true,
        captureError: true,
        silent: true
      });
      bootstrapMetrics.endPhase("auth_me", ok);

      if (!didTimeout) {
        setAuthState(ok ? "authenticated" : hadCachedUser ? "degraded" : "unauthenticated");
        securityDebug("auth", "bootstrap finished", { ok, reason });
        bootstrapMetrics.endBootstrap();
      }

      window.clearTimeout(timeoutId);
      bootstrapInFlightRef.current = false;
      console.timeEnd("startup:auth_bootstrap");
      console.info("[startup] auth bootstrap ms", Math.round(performance.now() - bootstrapStart));
      console.groupEnd();
    },
    [refresh]
  );

  useEffect(() => {
    void runBootstrap("bootstrap");
    // Intentionally run once on mount to prevent bootstrap loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryBootstrap = useCallback(() => {
    securityDebug("auth", "bootstrap retry requested");
    void runBootstrap("bootstrap-retry");
  }, [runBootstrap]);

  useEffect(() => {
    if (!user) return;

    // Defer runtime integrity monitor to background after auth is ready
    // This prevents blocking initial render
    const startIntegrityMonitor = () => {
      bootstrapMetrics.startPhase("runtime_integrity_start");
      
      const report = async (event: ClientSecurityEvent) => {
        try {
          await reportClientSecurityEvent(event);
        } catch {
          // Telemetry must never break the app; critical handling still clears local state.
        }
      };

      const cleanup = startRuntimeIntegrityMonitor({
        onTelemetry: report,
        onCritical: async (event) => {
          await report(event);
          sessionStorage.setItem(
            "ot_runtime_security_warning",
            "Your session was closed because the runtime integrity monitor detected suspicious browser-side tampering."
          );
          try {
            await logoutUser();
          } catch {
            // Local session is still cleared if server logout cannot complete.
          }
          clearSession();
          window.location.assign("/login");
        }
      });
      
      bootstrapMetrics.endPhase("runtime_integrity_start", true);
      return cleanup;
    };

    // Use setTimeout to defer to next tick, ensuring auth bootstrap completes first
    const timeoutId = setTimeout(() => {
      const cleanup = startIntegrityMonitor();
      // Store cleanup function for later
      (window as any).__runtimeIntegrityCleanup = cleanup;
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      const cleanup = (window as any).__runtimeIntegrityCleanup;
      if (cleanup) {
        cleanup();
        delete (window as any).__runtimeIntegrityCleanup;
      }
    };
  }, [clearSession, user?.id]);

  useEffect(() => {
    if (!user) return;

    const heartbeat = async () => {
      if (heartbeatInFlightRef.current) return;
      heartbeatInFlightRef.current = true;
      try {
        securityDebug("auth", "heartbeat started");
        const { data } = await apiClient.get<MeApi>("/v1/auth/me", { timeout: AUTH_REQUEST_TIMEOUT_MS });
        const latest = mapMe(data);
        const current = userRef.current;

        if (current && (latest.id !== current.id || latest.email !== current.email)) {
          identityMismatchCountRef.current += 1;
          securityDebug("auth", "heartbeat identity mismatch", {
            count: identityMismatchCountRef.current,
            previousUserId: current.id,
            latestUserId: latest.id
          });
          if (identityMismatchCountRef.current < 2) {
            return;
          }
          const event: ClientSecurityEvent = {
            action: "runtime.integrity.failure",
            severity: "critical",
            score: 100,
            reason: "Authenticated user identity changed during session heartbeat",
            signals: ["auth-identity-drift"],
            metadata: {
              previousUserId: current.id,
              latestUserId: latest.id
            }
          };
          try {
            await reportClientSecurityEvent(event);
          } catch {
            // Continue logout on identity drift even if audit telemetry fails.
          }
          await logoutUser().catch(() => undefined);
          clearSession();
          window.location.assign("/login");
          return;
        }

        identityMismatchCountRef.current = 0;
        const permissionsChanged = current?.permissions.join(",") !== latest.permissions.join(",");
        const profileChanged =
          current?.role !== latest.role ||
          current?.onboardingStatus !== latest.onboardingStatus ||
          permissionsChanged;
        if (profileChanged) {
          securityDebug("auth", "heartbeat refreshed auth state", { userId: latest.id });
          setUser(latest);
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          securityDebug("auth", "heartbeat got 401");
          clearSession();
          setBootstrapError("Session expired. Please sign in again.");
          setAuthState("expired");
        }
      } finally {
        heartbeatInFlightRef.current = false;
      }
    };

    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void heartbeat();
      }
    }, AUTH_HEARTBEAT_MS);

    return () => window.clearInterval(id);
  }, [clearSession, user?.email, user?.id]);

  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && !heartbeatInFlightRef.current) {
        void refresh({ reason: "visibility", silent: true });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh, user?.id]);

  const hasPermission = useCallback(
    (code: PermissionCode | PermissionCode[]) => {
      if (!user) return false;
      if (user.role === "admin") return true;
      const codes = Array.isArray(code) ? code : [code];
      return codes.some((c) => user.permissions.includes(c));
    },
    [user]
  );

  const hasRole = useCallback(
    (roles: UserRole | UserRole[]) => {
      if (!user?.role) return false;
      const allowed = Array.isArray(roles) ? roles : [roles];
      return allowed.includes(user.role);
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      authState,
      isLoading,
      isBooting,
      isRefreshing,
      isDegraded,
      isAuthenticated: Boolean(user),
      bootstrapError,
      setUser,
      refresh,
      retryBootstrap,
      forceLogout,
      clearSession,
      hasPermission,
      hasRole
    }),
    [
      user,
      authState,
      isLoading,
      isBooting,
      isRefreshing,
      isDegraded,
      bootstrapError,
      refresh,
      retryBootstrap,
      forceLogout,
      clearSession,
      hasPermission,
      hasRole
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
