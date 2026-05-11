import type { IndustryValue } from "../lib/industryOptions";

/** Mirrors backend `OnboardingStatus`; used for session + route guards. */
export type OnboardingStatus = "pending" | "approved" | "rejected";

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
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName?: string;
    role?: "admin" | "customer";
    onboardingStatus?: OnboardingStatus;
  };
};
