import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthenticatedLayout } from "../layouts/AuthenticatedLayout";
import * as authSession from "../lib/authSession";

declare global {
  var ResizeObserver: typeof window.ResizeObserver;
}

// Mock authSession
vi.mock("../lib/authSession", () => ({
  getUserRole: vi.fn(),
  hasRole: vi.fn(),
  getAuthSession: vi.fn(),
  isAuthenticated: vi.fn(),
  clearAuthSession: vi.fn()
}));

// Mock ResizeObserver for Framer Motion / UI components
window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("AuthenticatedLayout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authSession.getUserRole).mockReturnValue("admin");
    vi.mocked(authSession.hasRole).mockReturnValue(true);
    vi.mocked(authSession.isAuthenticated).mockReturnValue(true);
  });

  it("renders the Navbar but hides the Sidebar by default", () => {
    render(
      <MemoryRouter>
        <AuthenticatedLayout />
      </MemoryRouter>
    );

    // The logo should be visible in the Navbar
    expect(screen.getByRole("link", { name: /Sentinel/i }) || screen.getAllByRole("link")[0]).toBeInTheDocument();

    // Sidebar should NOT be visible (it uses motion.aside which mounts/unmounts via AnimatePresence)
    // "Control Center" is inside the sidebar
    expect(screen.queryByText(/Control Center/i)).not.toBeInTheDocument();
  });

  it("opens the Sidebar when a Top Nav item is clicked", async () => {
    render(
      <MemoryRouter>
        <AuthenticatedLayout />
      </MemoryRouter>
    );

    // It's hidden initially
    expect(screen.queryByText(/Control Center/i)).not.toBeInTheDocument();

    // Click a top nav link
    // The logo is [0], so a top nav link is [1]
    const navLink = screen.getAllByRole("link")[1]; 

    fireEvent.click(navLink);

    // Now the sidebar should be visible
    expect(await screen.findByText(/Control Center/i)).toBeInTheDocument();
  });
});
