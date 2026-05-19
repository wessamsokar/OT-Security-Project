import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BrainCircuit,
  Clock3,
  Network,
  Shield,
  ShieldCheck,
  Users
} from "lucide-react";

import type { PermissionCode, UserRole } from "../types/auth";

export type NavItem = {
  to: string;
  label: string;
  icon?: LucideIcon;
  roles?: UserRole[];
  permissions?: PermissionCode[];
  /** When onboarding is pending, only items with ``true`` stay visible (limited shell access). */
  allowPending?: boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const TOP_NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", permissions: ["view_dashboard"], allowPending: true },
  {
    to: "/dashboard/alerts",
    label: "Alerts",
    permissions: ["view_alerts"],
    roles: ["admin", "analyst"]
  },
  {
    to: "/dashboard/active-threats",
    label: "Threats",
    permissions: ["view_alerts"],
    roles: ["analyst"]
  },
  {
    to: "/dashboard/packets-analysed",
    label: "Telemetry",
    permissions: ["view_traffic"],
    roles: ["analyst", "viewer", "customer", "admin"]
  },
  { to: "/dashboard/devices", label: "Assets", permissions: ["view_devices"], roles: ["admin", "viewer", "customer"] },
  { to: "/dashboard/admin/users", label: "Users", permissions: ["view_users"], roles: ["admin"] },
  { to: "/dashboard/admin/roles", label: "Roles", permissions: ["view_roles"], roles: ["admin"] }
];

export const SIDEBAR_SECTIONS: NavSection[] = [
  {
    title: "SOC",
    items: [
      {
        to: "/dashboard",
        label: "Dashboard",
        icon: ShieldCheck,
        permissions: ["view_dashboard"],
        allowPending: true
      },
      {
        to: "/dashboard/active-threats",
        label: "Active Threats",
        icon: AlertTriangle,
        permissions: ["view_alerts"],
        roles: ["analyst"]
      },
      { to: "/dashboard/alerts", label: "Alerts", icon: Bell, permissions: ["view_alerts"], roles: ["admin", "analyst"] },
      { to: "/dashboard/devices", label: "Devices", icon: Activity, permissions: ["view_devices"], roles: ["admin", "viewer", "customer"] }
    ]
  },
  {
    title: "Operations",
    items: [
      { to: "/dashboard/inventory", label: "OT Inventory", icon: Network, permissions: ["view_devices"], roles: ["admin", "viewer", "customer"] },
      { to: "/dashboard/packets-analysed", label: "Traffic Telemetry", icon: BarChart3, permissions: ["view_traffic"], roles: ["admin", "analyst", "viewer", "customer"] },
      { to: "/dashboard/mttr", label: "MTTR", icon: Clock3, permissions: ["view_alerts"], roles: ["analyst"] }
    ]
  },
  {
    title: "Analytics",
    items: [
      { to: "/dashboard/soc-health", label: "SOC Health", icon: Shield, permissions: ["view_soc_health"], roles: ["admin", "viewer", "customer"] },
      { to: "/dashboard/ml-confidence", label: "ML Operations", icon: BrainCircuit, permissions: ["view_models"], roles: ["admin"] }
    ]
  },
  {
    title: "Admin",
    items: [
      { to: "/dashboard/admin/users", label: "Users", icon: Users, permissions: ["view_users"], roles: ["admin"] },
      { to: "/dashboard/admin/roles", label: "Roles", icon: ShieldCheck, permissions: ["view_roles"], roles: ["admin"] }
    ]
  }
];

export function navItemVisibleWhenPending(item: NavItem, isPendingShell: boolean): boolean {
  if (!isPendingShell) {
    return true;
  }
  return item.allowPending === true;
}

export function navItemVisibleForRole(item: NavItem, role: UserRole | undefined | null): boolean {
  if (!item.roles || item.roles.length === 0) {
    return true;
  }
  if (!role) {
    return false;
  }
  return item.roles.includes(role);
}

export const PUBLIC_NAV_ITEMS = [
  { to: "#features", label: "Features" },
  { to: "#workflow", label: "How it works" },
  { to: "#security", label: "Security" }
];
