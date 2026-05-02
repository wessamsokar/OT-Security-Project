import type { AuthApiResponse } from "../types/auth";

const SESSION_KEY = "ot_sentinel_auth_session";

export type UserRole = "admin" | "analyst" | "viewer";

type AuthSession = {
  token: string;
  user: {
    id: string;
    email: string;
    fullName?: string;
    role?: UserRole;
  };
};

function notifyAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-changed"));
  }
}

export function saveAuthSession(response: AuthApiResponse) {
  const session: AuthSession = {
    token: response.accessToken,
    user: response.user
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  notifyAuthChange();
}

export function getAuthSession(): AuthSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    const token = parsed?.token ?? "";
    const isLegacyToken = token === "placeholder-jwt-token";
    const isLikelyJwt = token.split(".").length === 3;

    if (!token || isLegacyToken || !isLikelyJwt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function isAuthenticated(): boolean {
  const session = getAuthSession();
  return Boolean(session?.token);
}

export function clearAuthSession() {
  localStorage.removeItem(SESSION_KEY);
  notifyAuthChange();
}

export function getUserRole(): UserRole | null {
  const session = getAuthSession();
  return session?.user?.role ?? null;
}

export function hasRole(roles: UserRole | UserRole[]): boolean {
  const current = getUserRole();
  if (!current) {
    return false;
  }

  const allowed = Array.isArray(roles) ? roles : [roles];
  return allowed.includes(current);
}
