import { AnimatePresence, motion } from "framer-motion";
import { Menu, PanelLeft, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { Logo } from "./Logo";
import { Button } from "../ui/Button";
import { clearAuthSession, getAuthSession, isAuthenticated } from "../../lib/authSession";

function getUserDisplayName() {
  const session = getAuthSession();
  const fullName = session?.user?.fullName?.trim() ?? "";
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1]}`;
  }

  if (parts.length === 1) {
    return `${parts[0]} Analyst`;
  }

  return "Security Analyst";
}

type NavbarProps = {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
};

export function Navbar({ isSidebarOpen = true, onToggleSidebar }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [authed, setAuthed] = useState<boolean>(isAuthenticated());
  const [displayName, setDisplayName] = useState<string>(getUserDisplayName());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      setAuthed(isAuthenticated());
      setDisplayName(getUserDisplayName());
    };
    window.addEventListener("storage", sync);
    window.addEventListener("auth-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("auth-changed", sync);
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <motion.header
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-xl"
    >
      <div className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
        <div className="flex items-center gap-2">
          {authed && onToggleSidebar ? (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="hidden rounded-xl border border-white/15 bg-white/5 p-2 text-muted transition-all hover:text-white md:inline-flex"
              aria-label="Toggle sidebar"
            >
              <motion.span
                animate={{ rotate: isSidebarOpen ? 0 : 180, scale: isSidebarOpen ? 1 : 1.08 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <PanelLeft size={16} />
              </motion.span>
            </button>
          ) : null}
          <Logo />
        </div>
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          {authed ? (
            <>
              <NavLink
                to="/dashboard"
                end
                className={({ isActive }) =>
                  ["transition-colors hover:text-text", isActive ? "text-text" : "text-muted"].join(" ")
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/dashboard/network-graph"
                className={({ isActive }) =>
                  ["transition-colors hover:text-text", isActive ? "text-text" : "text-muted"].join(" ")
                }
              >
                Network Graph
              </NavLink>
              <NavLink
                to="/dashboard/alerts"
                className={({ isActive }) =>
                  ["transition-colors hover:text-text", isActive ? "text-text" : "text-muted"].join(" ")
                }
              >
                Alerts
              </NavLink>
              <NavLink
                to="/dashboard/devices"
                className={({ isActive }) =>
                  ["transition-colors hover:text-text", isActive ? "text-text" : "text-muted"].join(" ")
                }
              >
                Devices
              </NavLink>
              <NavLink
                to="/dashboard/settings"
                className={({ isActive }) =>
                  ["transition-colors hover:text-text", isActive ? "text-text" : "text-muted"].join(" ")
                }
              >
                Settings
              </NavLink>
            </>
          ) : (
            <>
              <a href="#features" className="transition-colors hover:text-text">
                Features
              </a>
              <a href="#workflow" className="transition-colors hover:text-text">
                How it works
              </a>
              <a href="#security" className="transition-colors hover:text-text">
                Security
              </a>
            </>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex rounded-xl border border-white/15 bg-white/5 p-2 text-muted transition-all hover:text-white md:hidden"
            aria-label="Toggle top menu"
          >
            <motion.span
              animate={{ rotate: mobileMenuOpen ? 90 : 0, scale: mobileMenuOpen ? 1.06 : 1 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {mobileMenuOpen ? <X size={17} /> : <Menu size={17} />}
            </motion.span>
          </button>
          {authed ? (
            <>
              <Link to="/dashboard/profile">
                <Button variant="ghost" size="sm">
                  {displayName}
                </Button>
              </Link>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  clearAuthSession();
                  navigate("/", { replace: true });
                }}
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Login
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm">Start Free</Button>
              </Link>
            </>
          )}
        </div>

        <AnimatePresence>
          {mobileMenuOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="absolute left-4 right-4 top-[calc(100%+0.45rem)] rounded-2xl border border-white/10 bg-panel/95 p-3 shadow-panel md:hidden"
            >
              <div className="space-y-1">
                {authed ? (
                  <>
                    <NavLink to="/dashboard" className="block rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-white/10 hover:text-white">Dashboard</NavLink>
                    <NavLink to="/dashboard/network-graph" className="block rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-white/10 hover:text-white">Network Graph</NavLink>
                    <NavLink to="/dashboard/alerts" className="block rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-white/10 hover:text-white">Alerts</NavLink>
                    <NavLink to="/dashboard/devices" className="block rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-white/10 hover:text-white">Devices</NavLink>
                    <NavLink to="/dashboard/settings" className="block rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-white/10 hover:text-white">Settings</NavLink>
                  </>
                ) : (
                  <>
                    <a href="#features" className="block rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-white/10 hover:text-white">Features</a>
                    <a href="#workflow" className="block rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-white/10 hover:text-white">How it works</a>
                    <a href="#security" className="block rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-white/10 hover:text-white">Security</a>
                  </>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
