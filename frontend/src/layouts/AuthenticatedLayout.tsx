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
	ShieldCheck
} from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { Navbar } from "../components/layout/Navbar";

const menuItems = [
	{ to: "/dashboard", label: "Dashboard", icon: Network },
	{ to: "/dashboard/network-graph", label: "Network Graph", icon: Network },
	{ to: "/dashboard/devices", label: "Devices", icon: Activity },
	{ to: "/dashboard/packets-analysed", label: "Packets Analysed", icon: BarChart3 },
	{ to: "/dashboard/alerts", label: "Alerts", icon: Bell },
	{ to: "/dashboard/active-threats", label: "Active Threats", icon: AlertTriangle },
	{ to: "/dashboard/mttr", label: "MTTR", icon: Clock3 },
	{ to: "/dashboard/ml-confidence", label: "ML Confidence", icon: BrainCircuit },
	{ to: "/dashboard/my-tasks", label: "My Tasks", icon: ListChecks },
	{ to: "/dashboard/security-posture", label: "Security Posture", icon: Shield },
	{ to: "/dashboard/settings", label: "Settings & Privacy", icon: Settings2 }
];

export function AuthenticatedLayout() {
	const [isSidebarOpen, setIsSidebarOpen] = useState(true);

	return (
		<div className="min-h-screen bg-transparent text-text">
			<Navbar isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)} />

			<div className="mx-auto flex max-w-7xl px-4 pb-8 pt-24 md:px-8">
				<motion.aside
					initial={false}
					animate={
						isSidebarOpen
							? { width: 256, opacity: 1, x: 0 }
							: { width: 0, opacity: 0, x: -22 }
					}
					transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
					className="sticky top-24 hidden h-[calc(100vh-7rem)] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-panel/40 p-4 md:block"
				>
					<div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-brand/15 px-3 py-2 text-xs uppercase tracking-[0.14em] text-brand">
						<ShieldCheck size={14} /> OT Control Center
					</div>
					<nav className="space-y-2">
						{menuItems.map((item) => {
							const Icon = item.icon;
							return (
								<NavLink
									key={item.to}
									to={item.to}
									end={item.to === "/dashboard"}
									className={({ isActive }) =>
										[
											"flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
											isActive ? "bg-brand/20 text-white" : "text-muted hover:bg-white/5 hover:text-text"
										].join(" ")
									}
								>
									<Icon size={16} />
									<span>{item.label}</span>
								</NavLink>
							);
						})}
					</nav>
				</motion.aside>

				<motion.div
					initial={false}
					animate={{ paddingLeft: isSidebarOpen ? 24 : 0 }}
					transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
					className="min-w-0 flex-1"
				>
					<Outlet />
				</motion.div>
			</div>
		</div>
	);
}
