import axios from "axios";

const CSRF_COOKIE_NAME = "ics_csrf_token";
const CSRF_HEADER_NAME = "X-CSRF-Token";
const baseURL = import.meta.env.VITE_API_BASE_URL ?? "/api";

let cachedToken: string | null = null;
let inflight: Promise<string> | null = null;

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const prefix = `${CSRF_COOKIE_NAME}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

type CsrfOptions = {
  timeoutMs?: number;
};

/** Fetch a fresh CSRF token from the API and set the double-submit cookie. */
export async function ensureCsrfToken(options?: CsrfOptions): Promise<string> {
  const fromCookie = readCsrfCookie();
  if (fromCookie) {
    cachedToken = fromCookie;
    return fromCookie;
  }

  if (inflight) {
    return inflight;
  }

  // Use a bare axios call to avoid a circular dependency with apiClient interceptors.
  inflight = axios
    .get<{ csrf_token: string }>("/v1/auth/csrf", {
      baseURL,
      withCredentials: true,
      timeout: options?.timeoutMs
    })
    .then((res) => {
      const token = res.data.csrf_token || readCsrfCookie();
      if (!token) {
        throw new Error("CSRF token unavailable");
      }
      cachedToken = token;
      return token;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function getCachedCsrfToken(): string | null {
  return cachedToken ?? readCsrfCookie();
}

export function clearCsrfCache(): void {
  cachedToken = null;
}

export function csrfHeaderName(): string {
  return CSRF_HEADER_NAME;
}

export function isUnsafeMethod(method: string | undefined): boolean {
  const m = (method ?? "get").toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}
