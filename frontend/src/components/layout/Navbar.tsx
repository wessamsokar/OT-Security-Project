import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { Logo } from "./Logo";
import { Button } from "../ui/Button";
import { clearAuthSession, getAuthSession, getUserRole, hasRole, isAuthenticated } from "../../lib/authSession";
import { PUBLIC_NAV_ITEMS, TOP_NAV_ITEMS } from "../../lib/navigation";

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
  onNavItemClick?: () => void;
  onSidebarToggle?: () => void;
  isSidebarOpen?: boolean;
};

export function Navbar({ onNavItemClick, onSidebarToggle, isSidebarOpen = false }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [authed, setAuthed] = useState<boolean>(isAuthenticated());
  const [displayName, setDisplayName] = useState<string>(getUserDisplayName());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const role = getUserRole();

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
          {onSidebarToggle ? (
            <button
              type="button"
              onClick={onSidebarToggle}
              className="hidden items-center rounded-xl border border-white/10 bg-white/5 p-2 text-sm text-muted transition hover:text-white md:inline-flex"
              aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
              title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {isSidebarOpen ? <X size={15} /> : <Menu size={15} />}
            </button>
          ) : null}
          <Logo />
        </div>
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          {authed ? (
            <>
              {TOP_NAV_ITEMS.filter((item) => !item.roles || (role ? hasRole(item.roles) : false)).map((item) => (
                <motion.div
                  key={item.to}
                  whileHover={{
                    y: -2,
                    textShadow: "0 0 14px rgba(168,85,247,0.9)",
                    color: "rgb(221 214 254)"
                  }}
                  whileTap={{ scale: 0.97, textShadow: "0 0 10px rgba(168,85,247,0.75)" }}
                  transition={{ duration: 0.18 }}
                >
                  <NavLink
                    to={item.to}
                    end={item.to === "/dashboard"}
                    onClick={onNavItemClick}
                    className={({ isActive }) =>
                      [
                        "relative transition-colors duration-200 hover:text-violet-200",
                        isActive ? "text-violet-100" : "text-muted"
                      ].join(" ")
                    }
                  >
                    {item.label}
                  </NavLink>
                </motion.div>
              ))}
            </>
          ) : (
            <>
              {PUBLIC_NAV_ITEMS.map((item) =>
                item.to.startsWith("#") ? (
                  <motion.a
                    key={item.to}
                    href={item.to}
                    className="transition-colors hover:text-violet-200"
                    whileHover={{
                      y: -2,
                      textShadow: "0 0 14px rgba(168,85,247,0.95)",
                      color: "rgb(221 214 254)"
                    }}
                    whileTap={{ scale: 0.97, textShadow: "0 0 10px rgba(168,85,247,0.75)" }}
                    transition={{ duration: 0.18 }}
                  >
                    {item.label}
                  </motion.a>
                ) : (
                  <motion.div
                    key={item.to}
                    whileHover={{
                      y: -2,
                      textShadow: "0 0 14px rgba(168,85,247,0.95)",
                      color: "rgb(221 214 254)"
                    }}
                    whileTap={{ scale: 0.97, textShadow: "0 0 10px rgba(168,85,247,0.75)" }}
                    transition={{ duration: 0.18 }}
                  >
                    <NavLink to={item.to} className="transition-colors hover:text-violet-200">
                      {item.label}
                    </NavLink>
                  </motion.div>
                )
              )}
            </>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onSidebarToggle?.();
              setMobileMenuOpen((prev) => !prev);
            }}
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
              <motion.div
                className="rounded-xl2"
                whileHover={{
                  y: -2,
                  scale: 1.02,
                  boxShadow: "0 0 0 1px rgba(168,85,247,0.5), 0 0 20px rgba(168,85,247,0.45)"
                }}
                whileTap={{ scale: 0.97 }}
              >
                <Link to="/dashboard/profile">
                  <Button variant="ghost" size="sm">
                    {displayName}
                  </Button>
                </Link>
              </motion.div>
              <motion.div
                className="rounded-xl2"
                whileHover={{
                  y: -2,
                  scale: 1.02,
                  boxShadow: "0 0 0 1px rgba(168,85,247,0.5), 0 0 20px rgba(168,85,247,0.45)"
                }}
                whileTap={{ scale: 0.97 }}
              >
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
              </motion.div>
            </>
          ) : (
            <>
              <motion.div
                className="rounded-xl2"
                whileHover={{
                  y: -2,
                  scale: 1.02,
                  boxShadow: "0 0 0 1px rgba(168,85,247,0.5), 0 0 20px rgba(168,85,247,0.45)"
                }}
                whileTap={{ scale: 0.97 }}
              >
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
              </motion.div>
              <motion.div
                className="rounded-xl2"
                whileHover={{
                  y: -2,
                  scale: 1.02,
                  boxShadow: "0 0 0 1px rgba(168,85,247,0.5), 0 0 20px rgba(168,85,247,0.45)"
                }}
                whileTap={{ scale: 0.97 }}
              >
                <Link to="/register">
                  <Button size="sm">Start Free</Button>
                </Link>
              </motion.div>
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
                    {TOP_NAV_ITEMS.filter((item) => !item.roles || (role ? hasRole(item.roles) : false)).map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={onNavItemClick}
                        className="block rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-white/10 hover:text-white"
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </>
                ) : (
                  <>
                    {PUBLIC_NAV_ITEMS.map((item) =>
                      item.to.startsWith("#") ? (
                        <a
                          key={item.to}
                          href={item.to}
                          className="block rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-white/10 hover:text-white"
                        >
                          {item.label}
                        </a>
                      ) : (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className="block rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-white/10 hover:text-white"
                        >
                          {item.label}
                        </NavLink>
                      )
                    )}
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
