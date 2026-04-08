import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

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

export function Navbar() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean>(isAuthenticated());
  const [displayName, setDisplayName] = useState<string>(getUserDisplayName());

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

  return (
    <motion.header
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
        <Logo />
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
      </div>
    </motion.header>
  );
}
