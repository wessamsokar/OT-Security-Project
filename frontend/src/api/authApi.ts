import type { AuthApiResponse, AuthFormValues } from "../types/auth";

const fakeLatency = async (ms = 900) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const USERS_KEY = "ot_sentinel_registered_users";

type RegisteredUser = {
  id: string;
  email: string;
  fullName: string;
  password: string;
};

function getRegisteredUsers(): RegisteredUser[] {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as RegisteredUser[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem(USERS_KEY);
    return [];
  }
}

function saveRegisteredUsers(users: RegisteredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function loginUser(values: AuthFormValues): Promise<AuthApiResponse> {
  await fakeLatency();

  if (!values.email.includes("@") || values.password.length < 8) {
    throw new Error("Invalid email or password format.");
  }

  const users = getRegisteredUsers();
  const matchedUser = users.find((user) => user.email.toLowerCase() === values.email.toLowerCase());

  if (!matchedUser) {
    throw new Error("Account not found. Please create an account first.");
  }

  if (matchedUser.password !== values.password) {
    throw new Error("Incorrect password for this account.");
  }

  return {
    accessToken: "placeholder-jwt-token",
    user: {
      id: matchedUser.id,
      email: matchedUser.email,
      fullName: matchedUser.fullName
    }
  };
}

export async function registerUser(values: AuthFormValues): Promise<AuthApiResponse> {
  await fakeLatency(1100);

  if (!values.fullName || values.fullName.trim().length < 3) {
    throw new Error("Full name must be at least 3 characters.");
  }

  if (!values.email.includes("@") || values.password.length < 8) {
    throw new Error("Please provide valid registration credentials.");
  }

  const users = getRegisteredUsers();
  const alreadyExists = users.some((user) => user.email.toLowerCase() === values.email.toLowerCase());
  if (alreadyExists) {
    throw new Error("This email is already registered. Please login.");
  }

  const normalizedName = values.fullName.trim();
  const newUser: RegisteredUser = {
    id: `u-${Date.now()}`,
    email: values.email,
    fullName: normalizedName,
    password: values.password
  };
  saveRegisteredUsers([...users, newUser]);

  return {
    accessToken: "placeholder-jwt-token",
    user: {
      id: newUser.id,
      email: values.email,
      fullName: normalizedName
    }
  };
}
