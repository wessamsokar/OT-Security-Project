import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useAuth } from "./AuthContext";
import type { OnboardingStatus } from "../types/auth";

type Ctx = {
  status: OnboardingStatus | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const OnboardingAccessContext = createContext<Ctx | null>(null);

export function OnboardingAccessProvider({ children }: { children: ReactNode }) {
  const { user, isBooting, refresh } = useAuth();

  const value = useMemo<Ctx>(
    () => ({
      status: user?.onboardingStatus ?? null,
      isLoading: isBooting,
      refresh: async () => {
        await refresh();
      }
    }),
    [user?.onboardingStatus, isBooting, refresh]
  );

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
