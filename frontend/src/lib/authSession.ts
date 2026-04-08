import type { AuthApiResponse } from "../types/auth";

const SESSION_KEY = "ot_sentinel_auth_session";

type AuthSession = {
  token: string;
  user: {
    id: string;
    email: string;
    fullName?: string;
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
    return JSON.parse(raw) as AuthSession;
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
