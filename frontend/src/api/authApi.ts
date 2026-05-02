import { apiClient } from "./client";
import type { AuthApiResponse, AuthFormValues } from "../types/auth";
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
};

type FastApiValidationError = {
  msg?: string;
};

type FastApiErrorResponse = {
  detail?: string | FastApiValidationError[];
  message?: string;
};

function parseApiError(error: unknown, fallbackMessage: string): Error {
  if (!axios.isAxiosError<FastApiErrorResponse>(error)) {
    return new Error(fallbackMessage);
  }

  if (error.response?.status === 401) {
    return new Error("Invalid email or password.");
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
        role: me.role === "admin" ? "admin" : "customer"
      }
    };
  } catch (error) {
    throw parseApiError(error, "Unable to sign in right now.");
  }
}

export async function registerUser(values: AuthFormValues): Promise<void> {
  if (!values.fullName?.trim() || !values.email.trim() || !values.password) {
    throw new Error("Full name, email, and password are required.");
  }

  try {
    await apiClient.post("/v1/auth/register", {
      full_name: values.fullName.trim(),
      email: values.email.trim(),
      password: values.password
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
