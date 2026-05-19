import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AppRouter } from "../app/Router";
import { AuthProvider } from "../contexts/AuthContext";

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

vi.mock("../api/csrf", () => ({
  ensureCsrfToken: vi.fn().mockResolvedValue("test-csrf"),
  clearCsrfCache: vi.fn()
}));

declare global {
  var ResizeObserver: typeof window.ResizeObserver;
}

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
  onboarding_status: "approved",
  permissions: ["view_dashboard", "view_traffic"]
};

function renderRouter(initialPath = "/dashboard") {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/*" element={<AppRouter />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("AppRouter Protections", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("redirects unauthenticated users to login", async () => {
    mockApiGet.mockRejectedValue({ response: { status: 401 }, isAxiosError: true });
    renderRouter("/dashboard");
    await waitFor(() => {
      expect(screen.getByText(/sign in/i)).toBeInTheDocument();
    });
  });

  it("shows dashboard when session cookie validates via /me", async () => {
    mockApiGet.mockResolvedValue({ data: meApproved });
    renderRouter("/dashboard");
    await waitFor(() => {
      expect(screen.getByText("User Dashboard")).toBeInTheDocument();
    });
  });
});
