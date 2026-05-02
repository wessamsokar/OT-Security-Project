import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BrainCircuit,
  Clock3,
  ListChecks,
  Network,
  Settings2,
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
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

const ALL_ROLES: UserRole[] = ["admin", "analyst", "viewer"];

export const TOP_NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", roles: ALL_ROLES },
  { to: "/dashboard/alerts", label: "Alerts", roles: ALL_ROLES },
  { to: "/dashboard/devices", label: "Devices", roles: ALL_ROLES },
  { to: "/dashboard/demo", label: "Detection Demo", roles: ["admin", "analyst"] },
  { to: "/dashboard/admin/users", label: "Admin", roles: ["admin"] }
];

export const SIDEBAR_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: ShieldCheck, roles: ALL_ROLES },
      { to: "/dashboard/active-threats", label: "Active Threats", icon: AlertTriangle, roles: ALL_ROLES },
      { to: "/dashboard/alerts", label: "Alerts", icon: Bell, roles: ALL_ROLES }
    ]
  },
  {
    title: "Operations",
    items: [
      { to: "/dashboard/network-graph", label: "Network Graph", icon: Network, roles: ["admin", "analyst"] },
      { to: "/dashboard/devices", label: "Devices", icon: Activity, roles: ALL_ROLES },
      { to: "/dashboard/packets-analysed", label: "Packets Analysed", icon: BarChart3, roles: ALL_ROLES }
    ]
  },
  {
    title: "Analytics",
    items: [
      { to: "/dashboard/mttr", label: "MTTR", icon: Clock3, roles: ALL_ROLES },
      { to: "/dashboard/ml-confidence", label: "ML Confidence", icon: BrainCircuit, roles: ALL_ROLES },
      { to: "/dashboard/security-posture", label: "Security Posture", icon: Shield, roles: ALL_ROLES }
    ]
  },
  {
    title: "Workflows",
    items: [
      { to: "/dashboard/my-tasks", label: "My Tasks", icon: ListChecks, roles: ["admin", "analyst"] },
      { to: "/dashboard/demo", label: "Detection Demo", icon: ShieldCheck, roles: ["admin", "analyst"] }
    ]
  },
  {
    title: "Admin",
    items: [
      { to: "/dashboard/admin/users", label: "Users", icon: Users, roles: ["admin"] },
      { to: "/dashboard/admin/roles", label: "Roles & Permissions", icon: ShieldCheck, roles: ["admin"] }
    ]
  },
  {
    title: "Settings",
    items: [
      { to: "/dashboard/settings", label: "Settings & Privacy", icon: Settings2, roles: ALL_ROLES }
    ]
  }
];

export const PUBLIC_NAV_ITEMS = [
  { to: "/live-threats", label: "Live Snapshot" },
  { to: "#features", label: "Features" },
  { to: "#workflow", label: "How it works" },
  { to: "#security", label: "Security" }
];
