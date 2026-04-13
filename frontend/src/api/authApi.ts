import { apiClient } from "./client";
import type { AuthApiResponse, AuthFormValues } from "../types/auth";

type LoginResponse = {
  access_token: string;
  token_type: "bearer";
};

type MeResponse = {
  id: number;
  username: string;
  email: string;
  role: "admin" | "analyst" | "viewer";
};

export async function loginUser(values: AuthFormValues): Promise<AuthApiResponse> {
  if (!values.email.trim() || !values.password) {
    throw new Error("Username and password are required.");
  }

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
      role: me.role
    }
  };
}

export async function registerUser(values: AuthFormValues): Promise<AuthApiResponse> {
  void values;
  throw new Error("Self-registration is disabled. Ask an admin to create your account.");
}
