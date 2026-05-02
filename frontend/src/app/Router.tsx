import { AnimatePresence, motion } from "framer-motion";
import { Navigate, useLocation, useRoutes } from "react-router-dom";

import { hasRole, isAuthenticated } from "../lib/authSession";
import { AuthenticatedLayout } from "../layouts/AuthenticatedLayout";
import { ActiveThreatsPage } from "../pages/ActiveThreatsPage";
import { AlertsPage } from "../pages/AlertsPage";
import { AdminRolesPage } from "../pages/AdminRolesPage";
import { AdminUsersPage } from "../pages/AdminUsersPage";
import { DashboardPage } from "../pages/DashboardPage";
import { DemoPage } from "../pages/DemoPage";
import { DevicesPage } from "../pages/DevicesPage";
import { LiveSnapshotPage } from "../pages/LiveSnapshotPage";
import { LoginPage } from "../pages/LoginPage";
import { MlConfidencePage } from "../pages/MlConfidencePage";
import { MttrPage } from "../pages/MttrPage";
import { MyTasksPage } from "../pages/MyTasksPage";
import { HomePage } from "../pages/HomePage";
import { NetworkGraphPage } from "../pages/NetworkGraphPage";
import { PacketsAnalysedPage } from "../pages/PacketsAnalysedPage";
import { ProfilePage } from "../pages/ProfilePage";
import { RegisterPage } from "../pages/RegisterPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { SecurityPosturePage } from "../pages/SecurityPosturePage";
import { SettingsPrivacyPage } from "../pages/SettingsPrivacyPage";
import { VerifyEmailPage } from "../pages/VerifyEmailPage";

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

function RoleRoute({ roles, children }: { roles: Array<"admin" | "analyst" | "viewer">; children: JSX.Element }) {
  if (!hasRole(roles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AnimatedRoutes() {
  return useRoutes([
    { path: "/", element: <GuestOnlyRoute><HomePage /></GuestOnlyRoute> },
    { path: "/live-threats", element: <LiveSnapshotPage /> },
    {
      path: "/dashboard",
      element: (
        <ProtectedRoute>
          <AuthenticatedLayout />
        </ProtectedRoute>
      ),
      children: [
        { index: true, element: <DashboardPage /> },
        { path: "network-graph", element: <NetworkGraphPage /> },
        { path: "packets-analysed", element: <PacketsAnalysedPage /> },
        { path: "alerts", element: <AlertsPage /> },
        { path: "active-threats", element: <ActiveThreatsPage /> },
        { path: "mttr", element: <MttrPage /> },
        { path: "ml-confidence", element: <MlConfidencePage /> },
        {
          path: "my-tasks",
          element: (
            <RoleRoute roles={["admin", "analyst"]}>
              <MyTasksPage />
            </RoleRoute>
          )
        },
        { path: "security-posture", element: <SecurityPosturePage /> },
        { path: "devices", element: <DevicesPage /> },
        {
          path: "demo",
          element: (
            <RoleRoute roles={["admin", "analyst"]}>
              <DemoPage />
            </RoleRoute>
          )
        },
        {
          path: "admin/users",
          element: (
            <RoleRoute roles={["admin"]}>
              <AdminUsersPage />
            </RoleRoute>
          )
        },
        {
          path: "admin/roles",
          element: (
            <RoleRoute roles={["admin"]}>
              <AdminRolesPage />
            </RoleRoute>
          )
        },
        { path: "settings", element: <SettingsPrivacyPage /> },
        { path: "profile", element: <ProfilePage /> },
        { path: "*", element: <Navigate to="/dashboard" replace /> }
      ]
    },
    { path: "/login", element: <GuestOnlyRoute><LoginPage /></GuestOnlyRoute> },
    { path: "/register", element: <GuestOnlyRoute><RegisterPage /></GuestOnlyRoute> },
    { path: "/reset-password", element: <GuestOnlyRoute><ResetPasswordPage /></GuestOnlyRoute> },
    { path: "/verify-email", element: <GuestOnlyRoute><VerifyEmailPage /></GuestOnlyRoute> },
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
