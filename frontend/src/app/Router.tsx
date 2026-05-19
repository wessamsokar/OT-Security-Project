import { motion } from "framer-motion";
import { lazy, Suspense, useEffect, useRef } from "react";
import { Link, Navigate, useLocation, useRoutes } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { OnboardingAccessProvider, useOnboardingAccess } from "../contexts/OnboardingAccessContext";
import { AuthenticatedLayout } from "../layouts/AuthenticatedLayout";
import { lazyWithRetry } from "../lib/lazyRetry";
import { securityDebug } from "../lib/securityDebug";
import { NotFoundPage } from "../pages/NotFoundPage";
import type { PermissionCode } from "../types/auth";

const ActiveThreatsPage = lazyWithRetry(
  () => import("../pages/ActiveThreatsPage").then((m) => ({ default: m.ActiveThreatsPage })),
  { retryKey: "active-threats" }
);
const AlertsPage = lazyWithRetry(
  () => import("../pages/AlertsPage").then((m) => ({ default: m.AlertsPage })),
  { retryKey: "alerts" }
);
const AdminRolesPage = lazyWithRetry(
  () => import("../pages/AdminRolesPage").then((m) => ({ default: m.AdminRolesPage })),
  { retryKey: "admin-roles" }
);
const AdminUsersPage = lazyWithRetry(
  () => import("../pages/AdminUsersPage").then((m) => ({ default: m.AdminUsersPage })),
  { retryKey: "admin-users" }
);
const DashboardPage = lazyWithRetry(
  () => import("../pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
  { retryKey: "dashboard" }
);
const DevicesPage = lazyWithRetry(
  () => import("../pages/DevicesPage").then((m) => ({ default: m.DevicesPage })),
  { retryKey: "devices" }
);
const HomePage = lazyWithRetry(
  () => import("../pages/HomePage").then((m) => ({ default: m.HomePage })),
  { retryKey: "home" }
);
const LoginPage = lazyWithRetry(
  () => import("../pages/LoginPage").then((m) => ({ default: m.LoginPage })),
  { retryKey: "login" }
);
const MlConfidencePage = lazyWithRetry(
  () => import("../pages/MlConfidencePage").then((m) => ({ default: m.MlConfidencePage })),
  { retryKey: "ml-confidence" }
);
const MttrPage = lazyWithRetry(
  () => import("../pages/MttrPage").then((m) => ({ default: m.MttrPage })),
  { retryKey: "mttr" }
);
const OtInventoryPage = lazyWithRetry(
  () => import("../pages/OtInventoryPage").then((m) => ({ default: m.OtInventoryPage })),
  { retryKey: "ot-inventory" }
);
const PacketsAnalysedPage = lazyWithRetry(
  () => import("../pages/PacketsAnalysedPage").then((m) => ({ default: m.PacketsAnalysedPage })),
  { retryKey: "packets-analysed" }
);
const PendingVerificationPage = lazyWithRetry(
  () => import("../pages/PendingVerificationPage").then((m) => ({ default: m.PendingVerificationPage })),
  { retryKey: "pending-verification" }
);
const ProfilePage = lazyWithRetry(
  () => import("../pages/ProfilePage").then((m) => ({ default: m.ProfilePage })),
  { retryKey: "profile" }
);
const RegisterPage = lazyWithRetry(
  () => import("../pages/RegisterPage").then((m) => ({ default: m.RegisterPage })),
  { retryKey: "register" }
);
const SocHealthPage = lazyWithRetry(
  () => import("../pages/SocHealthPage").then((m) => ({ default: m.SocHealthPage })),
  { retryKey: "soc-health" }
);
const SettingsPrivacyPage = lazyWithRetry(
  () => import("../pages/SettingsPrivacyPage").then((m) => ({ default: m.SettingsPrivacyPage })),
  { retryKey: "settings-privacy" }
);

function InventoryLegacyRedirect() {
  const { hasPermission } = useAuth();
  if (hasPermission("view_devices")) {
    return <Navigate to="/dashboard/inventory" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

const pageVariants = {
  initial: { opacity: 0, y: 18, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -12, filter: "blur(4px)" }
};

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isBooting, authState } = useAuth();
  if (authState === "expired") {
    return <AuthRecoveryScreen />;
  }
  if (isBooting && !isAuthenticated) {
    return <ShellLoading />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function GuestOnlyRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isBooting } = useAuth();
  if (isBooting && !isAuthenticated) {
    return <ShellLoading />;
  }
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function PermissionRoute({ permission, children }: { permission: PermissionCode; children: JSX.Element }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) {
    return <NotFoundPage />;
  }
  return children;
}

function ShellLoading() {
  return null;
}

function RouteLoading() {
  return null;
}

function AuthRecoveryScreen() {
  const { bootstrapError, retryBootstrap, forceLogout } = useAuth();
  return (
    <div className="flex min-h-[50vh] items-center justify-center rounded-3xl border border-white/10 bg-panel/30 px-6 py-10 text-sm text-muted">
      <div className="max-w-md space-y-3 text-center">
        <p className="text-base font-semibold text-white">We could not verify your session.</p>
        <p className="text-sm text-muted">
          The authentication bootstrap did not complete. This can happen with stale cookies, CSRF failures, or a
          temporarily unavailable backend.
        </p>
        {bootstrapError ? <p className="text-xs text-danger">Last error: {bootstrapError}</p> : null}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={retryBootstrap}
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            Retry verification
          </button>
          <button
            type="button"
            onClick={forceLogout}
            className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-xs font-semibold text-muted transition hover:text-white"
          >
            Clear session
          </button>
          <Link
            to="/login"
            className="rounded-full border border-brand/40 bg-brand/15 px-4 py-2 text-xs font-semibold text-brand transition hover:bg-brand/25"
          >
            Continue to login
          </Link>
        </div>
      </div>
    </div>
  );
}

function DashboardHomeRoute() {
  const { status } = useOnboardingAccess();
  if (status === "pending") {
    return <PendingVerificationPage />;
  }
  return <DashboardPage />;
}

function PlatformFeatureRoute({ children }: { children: JSX.Element }) {
  const { status } = useOnboardingAccess();
  if (status === "pending") {
    return <Navigate to="/dashboard" replace />;
  }
  if (status === "rejected") {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function ProtectedShell() {
  return (
    <OnboardingAccessProvider>
      <AuthenticatedLayout />
    </OnboardingAccessProvider>
  );
}

function AnimatedRoutes() {
  const { isAuthenticated } = useAuth();

  return useRoutes([
    { path: "/", element: <GuestOnlyRoute><HomePage /></GuestOnlyRoute> },
    { path: "/live-threats", element: <Navigate to="/" replace /> },
    {
      path: "/dashboard",
      element: (
        <ProtectedRoute>
          <ProtectedShell />
        </ProtectedRoute>
      ),
      children: [
        { index: true, element: <DashboardHomeRoute /> },
        { path: "network-graph", element: <InventoryLegacyRedirect /> },
        {
          path: "inventory",
          element: (
            <PlatformFeatureRoute>
              <PermissionRoute permission="view_devices">
                <OtInventoryPage />
              </PermissionRoute>
            </PlatformFeatureRoute>
          )
        },
        {
          path: "packets-analysed",
          element: (
            <PlatformFeatureRoute>
              <PermissionRoute permission="view_traffic">
                <PacketsAnalysedPage />
              </PermissionRoute>
            </PlatformFeatureRoute>
          )
        },
        {
          path: "alerts",
          element: (
            <PlatformFeatureRoute>
              <PermissionRoute permission="view_alerts">
                <AlertsPage />
              </PermissionRoute>
            </PlatformFeatureRoute>
          )
        },
        {
          path: "active-threats",
          element: (
            <PlatformFeatureRoute>
              <PermissionRoute permission="view_alerts">
                <ActiveThreatsPage />
              </PermissionRoute>
            </PlatformFeatureRoute>
          )
        },
        {
          path: "mttr",
          element: (
            <PlatformFeatureRoute>
              <PermissionRoute permission="view_alerts">
                <MttrPage />
              </PermissionRoute>
            </PlatformFeatureRoute>
          )
        },
        {
          path: "ml-confidence",
          element: (
            <PlatformFeatureRoute>
              <PermissionRoute permission="view_models">
                <MlConfidencePage />
              </PermissionRoute>
            </PlatformFeatureRoute>
          )
        },
        { path: "security-posture", element: <Navigate to="/dashboard/soc-health" replace /> },
        {
          path: "soc-health",
          element: (
            <PlatformFeatureRoute>
              <PermissionRoute permission="view_soc_health">
                <SocHealthPage />
              </PermissionRoute>
            </PlatformFeatureRoute>
          )
        },
        {
          path: "devices",
          element: (
            <PlatformFeatureRoute>
              <PermissionRoute permission="view_devices">
                <DevicesPage />
              </PermissionRoute>
            </PlatformFeatureRoute>
          )
        },
        {
          path: "admin/users",
          element: (
            <PlatformFeatureRoute>
              <PermissionRoute permission="view_users">
                <AdminUsersPage />
              </PermissionRoute>
            </PlatformFeatureRoute>
          )
        },
        {
          path: "admin/roles",
          element: (
            <PlatformFeatureRoute>
              <PermissionRoute permission="view_roles">
                <AdminRolesPage />
              </PermissionRoute>
            </PlatformFeatureRoute>
          )
        },
        { path: "settings", element: <SettingsPrivacyPage /> },
        { path: "profile", element: <ProfilePage /> },
        { path: "*", element: <Navigate to="/dashboard" replace /> }
      ]
    },
    { path: "/login", element: <GuestOnlyRoute><LoginPage /></GuestOnlyRoute> },
    { path: "/register", element: <GuestOnlyRoute><RegisterPage /></GuestOnlyRoute> },
    { path: "/reset-password", element: <GuestOnlyRoute><LoginPage /></GuestOnlyRoute> },
    { path: "/verify-email", element: <GuestOnlyRoute><LoginPage /></GuestOnlyRoute> },
    { path: "*", element: <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace /> }
  ]);
}

export function AppRouter() {
  const location = useLocation();
  const renderCountRef = useRef(0);

  renderCountRef.current += 1;
  console.debug(`[router] AppRouter render ${renderCountRef.current}`);

  useEffect(() => {
    console.info("[router] AppRouter mounted");
    return () => {
      console.info("[router] AppRouter unmounted");
    };
  }, []);

  useEffect(() => {
    securityDebug("router", "route transition", { path: location.pathname });
  }, [location.pathname]);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.24, ease: "easeOut" }}
    >
      <Suspense fallback={<RouteLoading />}>
        <AnimatedRoutes />
      </Suspense>
    </motion.div>
  );
}
