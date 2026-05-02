import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppRouter } from "../app/Router";
import * as authSession from "../lib/authSession";

declare global {
  var ResizeObserver: typeof window.ResizeObserver;
}

// Mock authSession
vi.mock("../lib/authSession", () => ({
  isAuthenticated: vi.fn(),
  hasRole: vi.fn(),
  getUserRole: vi.fn(),
  getAuthSession: vi.fn(),
  clearAuthSession: vi.fn()
}));

// Mock ResizeObserver for Framer Motion / UI components
window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("AppRouter Protections", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("redirects to /login if trying to access /dashboard while unauthenticated", () => {
    vi.mocked(authSession.isAuthenticated).mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppRouter />
      </MemoryRouter>
    );

    // Because they aren't authenticated, they should be redirected to Login
    expect(screen.getByText(/sign in/i)).toBeInTheDocument(); // Assuming LoginPage has "Sign in" or similar text
  });

  it("allows access to /dashboard if authenticated", () => {
    vi.mocked(authSession.isAuthenticated).mockReturnValue(true);
    vi.mocked(authSession.hasRole).mockReturnValue(true);
    
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppRouter />
      </MemoryRouter>
    );

    // Dashboard has text "User Dashboard"
    expect(screen.getByText(/User Dashboard/i)).toBeInTheDocument();
  });

  it("blocks non-admin users from accessing /dashboard/admin/users", () => {
    vi.mocked(authSession.isAuthenticated).mockReturnValue(true);
    // Pretend user doesn't have the required role (admin)
    vi.mocked(authSession.hasRole).mockImplementation(() => false);

    render(
      <MemoryRouter initialEntries={["/dashboard/admin/users"]}>
        <AppRouter />
      </MemoryRouter>
    );

    // They should be redirected to index of /dashboard
    expect(screen.getByText(/User Dashboard/i)).toBeInTheDocument();
  });
});
