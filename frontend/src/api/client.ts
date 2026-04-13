import axios from "axios";
import { getAuthSession } from "../lib/authSession";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json"
  }
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthSession()?.token;
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
