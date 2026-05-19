import type { IndustryValue } from "../lib/industryOptions";

/** Mirrors backend `OnboardingStatus`; used for session + route guards. */
export type OnboardingStatus = "pending" | "approved" | "rejected";

export type UserRole = "admin" | "customer" | "analyst" | "viewer";

export type PermissionCode =
  | "view_dashboard"
  | "view_soc_health"
  | "view_alerts"
  | "manage_alerts"
  | "close_alerts"
  | "view_traffic"
  | "ingest_traffic"
  | "run_detection"
  | "view_devices"
  | "create_devices"
  | "edit_devices"
  | "delete_devices"
  | "view_models"
  | "retrain_models"
  | "view_users"
  | "manage_users"
  | "approve_users"
  | "view_roles"
  | "manage_roles"
  | "manage_permissions"
  | "view_audit_logs"
  | "view_streams"
  | "manage_packet_capture";

/** Registration payload aligned with backend `RegisterRequest`. */
export type OtRegisterPayload = {
  fullName: string;
  companyName: string;
  email: string;
  jobTitle: string;
  industryType: IndustryValue;
  infrastructureType: string;
  estimatedDeviceCount: number;
  country: string;
  purposeOfAccess: string;
  operatesOtIcs: boolean;
  password: string;
};

export type AuthFormValues = {
  fullName?: string;
  email: string;
  password: string;
};

export type AuthApiResponse = {
  user: {
    id: string;
    email: string;
    fullName?: string;
    role?: UserRole;
    onboardingStatus?: OnboardingStatus;
    permissions?: PermissionCode[];
  };
};
