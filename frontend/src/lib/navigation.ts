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

import type { UserRole } from "./authSession";

export type NavItem = {
  to: string;
  label: string;
  icon?: LucideIcon;
  roles?: UserRole[];
  /** When onboarding is pending, only items with ``true`` stay visible (limited shell access). */
  allowPending?: boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

const ALL_ROLES: UserRole[] = ["admin", "customer"];

export const TOP_NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", roles: ALL_ROLES, allowPending: true },
  { to: "/dashboard/alerts", label: "Alerts", roles: ["customer"] },
  { to: "/dashboard/devices", label: "Devices", roles: ["customer"] },
  { to: "/dashboard/admin/users", label: "Users", roles: ["admin"] },
  { to: "/dashboard/admin/roles", label: "Roles", roles: ["admin"] }
];

export const SIDEBAR_SECTIONS: NavSection[] = [
  {
    title: "SOC",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: ShieldCheck, roles: ALL_ROLES, allowPending: true },
      { to: "/dashboard/active-threats", label: "Active Threats", icon: AlertTriangle, roles: ["customer"] },
      { to: "/dashboard/alerts", label: "Alerts", icon: Bell, roles: ["customer"] },
      { to: "/dashboard/devices", label: "Devices", icon: Activity, roles: ["customer"] }
    ]
  },
  {
    title: "Operations",
    items: [
      { to: "/dashboard/inventory", label: "OT Inventory", icon: Network, roles: ["customer"] },
      { to: "/dashboard/packets-analysed", label: "Traffic Telemetry", icon: BarChart3, roles: ALL_ROLES },
      { to: "/dashboard/mttr", label: "MTTR", icon: Clock3, roles: ALL_ROLES }
    ]
  },
  {
    title: "Analytics",
    items: [
      { to: "/dashboard/soc-health", label: "SOC Health", icon: Shield, roles: ALL_ROLES },
      { to: "/dashboard/ml-confidence", label: "ML Operations", icon: BrainCircuit, roles: ["admin"] }
    ]
  },
  {
    title: "Admin",
    items: [
      { to: "/dashboard/admin/users", label: "Users", icon: Users, roles: ["admin"] },
      { to: "/dashboard/admin/roles", label: "Roles", icon: ShieldCheck, roles: ["admin"] }
    ]
  }
];

export function navItemVisibleWhenPending(item: NavItem, isPendingShell: boolean): boolean {
  if (!isPendingShell) {
    return true;
  }
  return item.allowPending === true;
}

export const PUBLIC_NAV_ITEMS = [
  { to: "#features", label: "Features" },
  { to: "#workflow", label: "How it works" },
  { to: "#security", label: "Security" }
];
