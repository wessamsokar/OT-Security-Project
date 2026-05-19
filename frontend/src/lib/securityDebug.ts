export function securityDebug(scope: string, message: string, data?: unknown): void {
  if (typeof window === "undefined") return;
  const enabled =
    localStorage.getItem("ot_security_debug") === "true" ||
    import.meta.env.VITE_SECURITY_DEBUG === "true";
  if (!enabled) return;
  // Debug output is opt-in so production users do not leak security-sensitive state.
  console.debug(`[security:${scope}] ${message}`, data ?? "");
}
