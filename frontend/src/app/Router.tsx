import { AnimatePresence, motion } from "framer-motion";
import { Navigate, useLocation, useRoutes } from "react-router-dom";

import { OnboardingAccessProvider, useOnboardingAccess } from "../contexts/OnboardingAccessContext";
import { hasRole, isAuthenticated } from "../lib/authSession";

function InventoryLegacyRedirect() {
  if (hasRole("customer")) {
    return <Navigate to="/dashboard/inventory" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}
import { AuthenticatedLayout } from "../layouts/AuthenticatedLayout";
import { ActiveThreatsPage } from "../pages/ActiveThreatsPage";
import { AlertsPage } from "../pages/AlertsPage";
import { AdminRolesPage } from "../pages/AdminRolesPage";
import { AdminUsersPage } from "../pages/AdminUsersPage";
import { DashboardPage } from "../pages/DashboardPage";
import { PendingVerificationPage } from "../pages/PendingVerificationPage";
import { DevicesPage } from "../pages/DevicesPage";
import { LoginPage } from "../pages/LoginPage";
import { MlConfidencePage } from "../pages/MlConfidencePage";
import { MttrPage } from "../pages/MttrPage";
import { HomePage } from "../pages/HomePage";
import { OtInventoryPage } from "../pages/OtInventoryPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PacketsAnalysedPage } from "../pages/PacketsAnalysedPage";
import { ProfilePage } from "../pages/ProfilePage";
import { RegisterPage } from "../pages/RegisterPage";
import { SocHealthPage } from "../pages/SocHealthPage";
import { SettingsPrivacyPage } from "../pages/SettingsPrivacyPage";

const pageVariants = {
  initial: { opacity: 0, y: 18, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -12, filter: "blur(4px)" }
};

function ProtectedRoute({ children }: { children: JSX.Element }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function GuestOnlyRoute({ children }: { children: JSX.Element }) {
  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function RoleRoute({ roles, children }: { roles: Array<"admin" | "customer">; children: JSX.Element }) {
  if (!hasRole(roles)) {
    return <NotFoundPage />;
  }

  return children;
}

function ShellLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center rounded-3xl border border-white/10 bg-panel/30 px-6 text-sm text-muted">
      Verifying your account status…
    </div>
  );
}

function DashboardHomeRoute() {
  const { status, isLoading } = useOnboardingAccess();
  if (isLoading) {
    return <ShellLoading />;
  }
  if (status === "pending") {
    return <PendingVerificationPage />;
  }
  return <DashboardPage />;
}

function PlatformFeatureRoute({ children }: { children: JSX.Element }) {
  const { status, isLoading } = useOnboardingAccess();
  if (isLoading) {
    return <ShellLoading />;
  }
  if (status === "pending") {
    return <Navigate to="/dashboard" replace />;
  }
  if (status === "rejected") {
    return null;
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
              <RoleRoute roles={["customer"]}>
                <OtInventoryPage />
              </RoleRoute>
            </PlatformFeatureRoute>
          )
        },
        {
          path: "packets-analysed",
          element: (
            <PlatformFeatureRoute>
              <RoleRoute roles={["customer", "admin"]}>
                <PacketsAnalysedPage />
              </RoleRoute>
            </PlatformFeatureRoute>
          )
        },
        {
          path: "alerts",
          element: (
            <PlatformFeatureRoute>
              <RoleRoute roles={["customer"]}>
                <AlertsPage />
              </RoleRoute>
            </PlatformFeatureRoute>
          )
        },
        {
          path: "active-threats",
          element: (
            <PlatformFeatureRoute>
              <RoleRoute roles={["customer"]}>
                <ActiveThreatsPage />
              </RoleRoute>
            </PlatformFeatureRoute>
          )
        },
        {
          path: "mttr",
          element: (
            <PlatformFeatureRoute>
              <RoleRoute roles={["admin"]}>
                <MttrPage />
              </RoleRoute>
            </PlatformFeatureRoute>
          )
        },
        {
          path: "ml-confidence",
          element: (
            <PlatformFeatureRoute>
              <RoleRoute roles={["admin"]}>
                <MlConfidencePage />
              </RoleRoute>
            </PlatformFeatureRoute>
          )
        },
        { path: "security-posture", element: <Navigate to="/dashboard/soc-health" replace /> },
        {
          path: "soc-health",
          element: (
            <PlatformFeatureRoute>
              <RoleRoute roles={["admin", "customer"]}>
                <SocHealthPage />
              </RoleRoute>
            </PlatformFeatureRoute>
          )
        },
        {
          path: "devices",
          element: (
            <PlatformFeatureRoute>
              <RoleRoute roles={["customer"]}>
                <DevicesPage />
              </RoleRoute>
            </PlatformFeatureRoute>
          )
        },
        {
          path: "admin/users",
          element: (
            <PlatformFeatureRoute>
              <RoleRoute roles={["admin"]}>
                <AdminUsersPage />
              </RoleRoute>
            </PlatformFeatureRoute>
          )
        },
        {
          path: "admin/roles",
          element: (
            <PlatformFeatureRoute>
              <RoleRoute roles={["admin"]}>
                <AdminRolesPage />
              </RoleRoute>
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
    { path: "*", element: <Navigate to={isAuthenticated() ? "/dashboard" : "/login"} replace /> }
  ]);
}

export function AppRouter() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.38, ease: "easeOut" }}
      >
        <AnimatedRoutes />
      </motion.div>
    </AnimatePresence>
  );
}
