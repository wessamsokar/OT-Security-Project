import { apiClient } from "./client";
import type { AuthApiResponse, AuthFormValues, OnboardingStatus, OtRegisterPayload } from "../types/auth";
import axios from "axios";

type LoginResponse = {
  access_token: string;
  token_type: "bearer";
};

type MeResponse = {
  id: number;
  username: string;
  email: string;
  role: "admin" | "customer" | "analyst" | "viewer";
  is_email_verified: boolean;
  is_admin_approved: boolean;
  onboarding_status: string;
};

type FastApiValidationError = {
  msg?: string;
};

type FastApiErrorResponse = {
  detail?: string | FastApiValidationError[];
  message?: string;
};

function normalizeMeOnboarding(raw: string | undefined): OnboardingStatus | undefined {
  const v = String(raw ?? "").toLowerCase();
  if (v === "pending" || v === "approved" || v === "rejected") {
    return v;
  }
  return undefined;
}

function parseApiError(error: unknown, fallbackMessage: string): Error {
  if (!axios.isAxiosError<FastApiErrorResponse>(error)) {
    return new Error(fallbackMessage);
  }

  if (error.response?.status === 401) {
    return new Error("Invalid email or password.");
  }

  if (error.response?.status === 403) {
    const d403 = error.response?.data?.detail;
    if (typeof d403 === "string" && d403.trim()) {
      return new Error(d403);
    }
  }

  const detail = error.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) {
    return new Error(detail);
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const firstMessage = detail.find((item) => item?.msg)?.msg;
    if (firstMessage?.trim()) {
      return new Error(firstMessage);
    }
  }

  const message = error.response?.data?.message;
  if (typeof message === "string" && message.trim()) {
    return new Error(message);
  }

  return new Error(fallbackMessage);
}

export async function loginUser(values: AuthFormValues): Promise<AuthApiResponse> {
  if (!values.email.trim() || !values.password) {
    throw new Error("Username and password are required.");
  }

  try {
    const loginResponse = await apiClient.post<LoginResponse>("/v1/auth/login", {
      username: values.email.trim(),
      password: values.password
    });

    const token = loginResponse.data.access_token;
    const meResponse = await apiClient.get<MeResponse>("/v1/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const me = meResponse.data;

    return {
      accessToken: token,
      user: {
        id: String(me.id),
        email: me.email,
        fullName: me.username,
        role: me.role === "admin" ? "admin" : "customer",
        onboardingStatus: normalizeMeOnboarding(me.onboarding_status)
      }
    };
  } catch (error) {
    throw parseApiError(error, "Unable to sign in right now.");
  }
}

export async function registerUser(payload: OtRegisterPayload): Promise<void> {
  const {
    fullName,
    companyName,
    email,
    jobTitle,
    industryType,
    infrastructureType,
    estimatedDeviceCount,
    country,
    purposeOfAccess,
    operatesOtIcs,
    password
  } = payload;

  if (
    !fullName.trim() ||
    !companyName.trim() ||
    !email.trim() ||
    !jobTitle.trim() ||
    !infrastructureType.trim() ||
    !country.trim() ||
    !purposeOfAccess.trim() ||
    !password
  ) {
    throw new Error("Please complete all required fields.");
  }

  try {
    await apiClient.post("/v1/auth/register", {
      full_name: fullName.trim(),
      company_name: companyName.trim(),
      email: email.trim(),
      job_title: jobTitle.trim(),
      industry_type: industryType,
      infrastructure_type: infrastructureType.trim(),
      estimated_device_count: estimatedDeviceCount,
      country: country.trim(),
      purpose_of_access: purposeOfAccess.trim(),
      operates_ot_ics: operatesOtIcs,
      password
    });
  } catch (error) {
    throw parseApiError(error, "Unable to create account right now.");
  }
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  try {
    const response = await apiClient.post<{ message: string }>("/v1/auth/forgot-password", { email });
    return response.data;
  } catch (error) {
    throw parseApiError(error, "Unable to request password reset right now.");
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>("/v1/auth/reset-password", {
    token,
    new_password: newPassword
  });
  return response.data;
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>("/v1/auth/verify-email", { token });
  return response.data;
}
