import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AppRouter } from "../app/Router";
import * as authSession from "../lib/authSession";

const { mockApiGet } = vi.hoisted(() => ({
  mockApiGet: vi.fn()
}));

vi.mock("../pages/DashboardPage", () => ({
  DashboardPage: () => <div>User Dashboard</div>
}));

vi.mock("../api/client", () => ({
  apiClient: {
    get: mockApiGet,
    post: vi.fn(),
    defaults: { headers: {} },
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() }
    }
  }
}));

declare global {
  var ResizeObserver: typeof window.ResizeObserver;
}

vi.mock("../lib/authSession", async (importActual) => {
  const actual = await importActual<typeof import("../lib/authSession")>();
  return {
    ...actual,
    isAuthenticated: vi.fn(),
    hasRole: vi.fn(),
    getAuthSession: vi.fn(),
    clearAuthSession: vi.fn()
  };
});

window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

globalThis.EventSource = class EventSourceStub {
  onopen: (() => void) | null = null;
  onerror: ((_ev: Event) => void) | null = null;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    queueMicrotask(() => this.onopen?.());
  }

  close() {}

  addEventListener() {}

  removeEventListener() {}

  dispatchEvent(): boolean {
    return false;
  }
} as unknown as typeof EventSource;

const meApproved = {
  id: 1,
  username: "Tester",
  email: "tester@example.com",
  role: "customer",
  is_email_verified: true,
  is_admin_approved: true,
  onboarding_status: "approved"
};

describe("AppRouter Protections", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockApiGet.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes("auth/me")) {
        return Promise.resolve({ data: meApproved });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it("redirects to /login if trying to access /dashboard while unauthenticated", () => {
    vi.mocked(authSession.isAuthenticated).mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppRouter />
      </MemoryRouter>
    );

    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });

  it("allows access to /dashboard if authenticated and onboarding approved", async () => {
    vi.mocked(authSession.isAuthenticated).mockReturnValue(true);
    vi.mocked(authSession.hasRole).mockReturnValue(true);
    vi.mocked(authSession.getAuthSession).mockReturnValue({
      token: "eyJhbGciOiJIUzI1NiJ9.payload.sig",
      user: { id: "1", email: "tester@example.com", role: "customer", onboardingStatus: "approved" }
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppRouter />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/User Dashboard/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it("blocks non-admin users from accessing /dashboard/admin/users", async () => {
    vi.mocked(authSession.isAuthenticated).mockReturnValue(true);
    vi.mocked(authSession.hasRole).mockImplementation(() => false);
    vi.mocked(authSession.getAuthSession).mockReturnValue({
      token: "eyJhbGciOiJIUzI1NiJ9.payload.sig",
      user: { id: "1", email: "tester@example.com", role: "customer", onboardingStatus: "approved" }
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/admin/users"]}>
        <AppRouter />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/This page is unavailable/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
