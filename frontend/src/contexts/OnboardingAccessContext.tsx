import axios from "axios";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { apiClient } from "../api/client";
import { clearAuthSession, getAuthSession, getStoredOnboardingStatus, patchAuthSessionUser } from "../lib/authSession";
import type { OnboardingStatus } from "../types/auth";

type MeApi = {
  id: number;
  username: string;
  email: string;
  role: string;
  is_email_verified: boolean;
  is_admin_approved: boolean;
  onboarding_status: string;
};

type Ctx = {
  status: OnboardingStatus | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const OnboardingAccessContext = createContext<Ctx | null>(null);

function normalizeOnboarding(raw: string | undefined | null): OnboardingStatus | null {
  const v = String(raw ?? "").toLowerCase();
  if (v === "pending" || v === "approved" || v === "rejected") {
    return v;
  }
  return null;
}

export function OnboardingAccessProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<OnboardingStatus | null>(() => {
    return normalizeOnboarding(getAuthSession()?.user?.onboardingStatus ?? null);
  });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const session = getAuthSession();
    if (!session?.token) {
      setStatus(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data } = await apiClient.get<MeApi>("/v1/auth/me");
      const nextStatus = normalizeOnboarding(data.onboarding_status) ?? "approved";
      patchAuthSessionUser({
        id: String(data.id),
        email: data.email,
        fullName: data.username,
        role: data.role === "admin" ? "admin" : "customer",
        onboardingStatus: nextStatus
      });
      setStatus(nextStatus);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        clearAuthSession();
        setStatus(null);
        window.location.assign("/login");
        return;
      }
      setStatus(getStoredOnboardingStatus() ?? "approved");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refresh]);

  const value = useMemo<Ctx>(() => ({ status, isLoading, refresh }), [status, isLoading, refresh]);

  return <OnboardingAccessContext.Provider value={value}>{children}</OnboardingAccessContext.Provider>;
}

export function useOnboardingAccess(): Ctx {
  const ctx = useContext(OnboardingAccessContext);
  if (!ctx) {
    throw new Error("useOnboardingAccess must be used within OnboardingAccessProvider");
  }
  return ctx;
}

export function useOptionalOnboardingAccess(): Ctx | null {
  return useContext(OnboardingAccessContext);
}
