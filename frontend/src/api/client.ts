import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

import { clearCsrfCache, csrfHeaderName, ensureCsrfToken, isUnsafeMethod } from "./csrf";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "/api";
const nonce = document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content;

if (nonce && nonce !== "__CSP_NONCE__") {
  window.__CSP_NONCE__ = nonce;
}

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (isUnsafeMethod(config.method)) {
    const token = await ensureCsrfToken();
    config.headers[csrfHeaderName()] = token;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
    const method = (error.config?.method ?? "get").toLowerCase();
    const isIdempotent = method === "get" || method === "head";
    const retryConfig = error.config as (InternalAxiosRequestConfig & { _serviceRetry?: number }) | undefined;
    const isCsrfFailure =
      status === 403 &&
      (detail === "CSRF token missing" ||
        detail === "CSRF token invalid" ||
        String(detail ?? "").toLowerCase().includes("csrf"));

    if (isCsrfFailure && error.config && !(error.config as { _csrfRetry?: boolean })._csrfRetry) {
      clearCsrfCache();
      const retryConfig = { ...error.config, _csrfRetry: true } as InternalAxiosRequestConfig & {
        _csrfRetry?: boolean;
      };
      if (isUnsafeMethod(retryConfig.method)) {
        const token = await ensureCsrfToken();
        retryConfig.headers[csrfHeaderName()] = token;
      }
      return apiClient.request(retryConfig);
    }

    if (status === 503 && retryConfig && isIdempotent) {
      const attempt = retryConfig._serviceRetry ?? 0;
      if (attempt < 2) {
        retryConfig._serviceRetry = attempt + 1;
        const backoffMs = 800 * (attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return apiClient.request(retryConfig);
      }
      return Promise.reject(new Error("Service temporarily unavailable. Please retry in a moment."));
    }

    if (status === 503) {
      return Promise.reject(new Error("Service temporarily unavailable. Please retry in a moment."));
    }

    return Promise.reject(error);
  }
);
