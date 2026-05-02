import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { Logo } from "../components/layout/Logo";
import { Navbar } from "../components/layout/Navbar";
import { getUserRole, hasRole } from "../lib/authSession";
import { SIDEBAR_SECTIONS } from "../lib/navigation";

export function AuthenticatedLayout() {
	const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
		if (typeof window === "undefined") return false;
		return localStorage.getItem("ics_sidebar_open") === "true";
	});
	const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
	const role = getUserRole();
	const sections = SIDEBAR_SECTIONS.map((section) => ({
		...section,
		items: section.items.filter((item) => !item.roles || hasRole(item.roles))
	})).filter((section) => section.items.length > 0);

	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem("ics_sidebar_open", isSidebarOpen ? "true" : "false");
		}
	}, [isSidebarOpen]);

	return (
		<div className="min-h-screen bg-transparent text-text">
			<Navbar
				onNavItemClick={() => setIsSidebarOpen(true)}
				onSidebarToggle={toggleSidebar}
				isSidebarOpen={isSidebarOpen}
			/>

			<div className="mx-auto flex max-w-7xl px-4 pb-8 pt-24 md:px-8">
				<AnimatePresence initial={false}>
					{isSidebarOpen ? (
						<motion.aside
							initial={{ width: 0, opacity: 0, x: -24 }}
							animate={{ width: 260, opacity: 1, x: 0 }}
							exit={{ width: 0, opacity: 0, x: -22 }}
							transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
							className="sticky top-24 hidden h-[calc(100vh-7rem)] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-panel/40 p-4 md:block"
						>
							<div className="flex items-center justify-between gap-2">
								<div className="flex items-center gap-2">
									<Logo withText={false} />
									<div>
										<p className="text-xs uppercase tracking-[0.14em] text-brand">Control Center</p>
										<p className="text-sm font-semibold text-white">{role ?? "Operator"}</p>
									</div>
								</div>
								<button
									type="button"
									onClick={() => setIsSidebarOpen(false)}
									className="rounded-lg border border-white/10 bg-white/5 p-1 text-muted transition hover:text-white"
									aria-label="Collapse sidebar"
								>
									<X size={14} />
								</button>
							</div>

							<div className="mt-4 space-y-4">
								{sections.map((section) => (
									<div key={section.title}>
										<p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted">
											{section.title}
										</p>
										<nav className="space-y-1">
											{section.items.map((item) => {
												const Icon = item.icon;
												return (
													<NavLink
														key={item.to}
														to={item.to}
														end={item.to === "/dashboard"}
														className={({ isActive }) =>
															[
																"flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
																isActive
																	? "bg-brand/20 text-white"
																	: "text-muted hover:bg-white/5 hover:text-text"
															].join(" ")
														}
													>
														{Icon ? <Icon size={16} /> : null}
														<span>{item.label}</span>
													</NavLink>
												);
											})}
										</nav>
									</div>
								))}
							</div>
						</motion.aside>
					) : null}
				</AnimatePresence>

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
