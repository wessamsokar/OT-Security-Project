import { apiClient } from "./client";

export type ClientSecurityAction = "tamper.detected" | "devtools.detected" | "runtime.integrity.failure";

export type ClientSecurityEvent = {
  action: ClientSecurityAction;
  severity: "low" | "medium" | "high" | "critical";
  score: number;
  reason: string;
  signals: string[];
  metadata?: Record<string, string | number | boolean | null>;
};

export async function reportClientSecurityEvent(event: ClientSecurityEvent): Promise<void> {
  await apiClient.post("/v1/audit/client-security-event", event);
}
