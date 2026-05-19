import { motion } from "framer-motion";
import { ChevronDown, Building } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { useTenant } from "../../contexts/TenantContext";
import { useAuth } from "../../contexts/AuthContext";

export function TenantSelector() {
  const {
    activeTenantId,
    setActiveTenantId,
    assignedCustomers,
    canSelectTenant,
    isLoadingAssignments,
    isSwitchingTenant
  } = useTenant();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // For admin: filter to only customer-role users from the already-loaded list.
  // For analyst/viewer: assignedCustomers is already assignment-scoped to customers only.
  const isAdmin = user?.role === "admin";
  const customerOptions = isAdmin
    ? assignedCustomers.filter((c) => c.role === "customer")
    : assignedCustomers;

  const badgeClass = (id?: number) => {
    const palette = [
      "bg-emerald-500/15 text-emerald-100 border-emerald-500/30",
      "bg-cyan-500/15 text-cyan-100 border-cyan-500/30",
      "bg-amber-500/15 text-amber-100 border-amber-500/30",
      "bg-violet-500/15 text-violet-100 border-violet-500/30",
      "bg-rose-500/15 text-rose-100 border-rose-500/30"
    ];
    if (id == null) return palette[0];
    return palette[id % palette.length];
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!canSelectTenant) return null;

  if (isLoadingAssignments) {
    return (
      <div className="mt-4 px-2">
        <div className="flex h-10 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-xs text-muted">
          Loading Customers...
        </div>
      </div>
    );
  }

  // Non-admin with no assignments
  if (!isAdmin && customerOptions.length === 0) {
    return (
      <div className="mt-4 px-2">
        <div className="flex h-10 items-center justify-center rounded-xl border border-rose-500/10 bg-rose-500/5 text-xs text-muted">
          No customer environments assigned yet.
        </div>
      </div>
    );
  }

  // Single assignment for analyst/viewer — show fixed context chip, no dropdown needed
  if (customerOptions.length === 1 && !isAdmin) {
    const single = customerOptions[0];
    return (
      <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-brand/20 bg-brand/5 p-2 px-3">
        <Building size={14} className="text-brand" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs font-medium text-white">{single.company_name || single.username}</span>
          <span className="truncate text-[10px] text-muted">Active Customer Scope</span>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${badgeClass(single.id)}`}>
          Customer
        </span>
      </div>
    );
  }

  const activeCustomer = customerOptions.find((c) => c.id === activeTenantId) ?? (!isAdmin ? customerOptions[0] : undefined);
  const isGlobal = isAdmin && activeTenantId === undefined;

  return (
    <div className="mt-4 relative z-50" ref={dropdownRef}>
      <motion.button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.01, borderColor: "rgba(168,85,247,0.4)" }}
        whileTap={{ scale: 0.98 }}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-panel/60 p-2 pl-3 transition hover:bg-white/5"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Building size={14} className="text-brand shrink-0" />
          <div className="flex flex-col items-start min-w-0">
            <span className="truncate text-xs font-semibold text-white max-w-[150px]">
              {isGlobal
                ? "Global View"
                : activeCustomer?.company_name || activeCustomer?.username || "Select Customer"}
            </span>
            <span className="text-[10px] text-muted">
              {isGlobal ? "All Customers" : "Customer Scope"}
              {isSwitchingTenant ? " · Switching" : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
              isGlobal ? "bg-white/10 text-white border-white/20" : badgeClass(activeCustomer?.id)
            }`}
          >
            {isGlobal ? "Platform" : "Customer"}
          </span>
          <ChevronDown size={14} className={`text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </motion.button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-panel/95 p-1 shadow-xl backdrop-blur-xl"
        >
          {/* Admin-only: Global View at top */}
          {isAdmin && (
            <button
              onClick={() => {
                setActiveTenantId(undefined);
                setIsOpen(false);
              }}
              className={`flex w-full flex-col items-start rounded-lg px-3 py-2 text-left text-sm transition ${
                activeTenantId === undefined
                  ? "bg-brand/20 text-white"
                  : "text-muted hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="font-medium">Global View</span>
              <span className="text-xs text-muted/80">All customer tenants</span>
            </button>
          )}

          {/* Customer-only list entries */}
          {customerOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted italic">No customer tenants available.</div>
          ) : (
            customerOptions.map((customer) => (
              <button
                key={customer.id}
                onClick={() => {
                  setActiveTenantId(customer.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  activeTenantId === customer.id
                    ? "bg-brand/20 text-white"
                    : "text-muted hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="min-w-0">
                  <span className="block font-medium truncate">
                    {customer.company_name || customer.username}
                  </span>
                  <span className="block text-xs text-muted/80 truncate">{customer.email}</span>
                </div>
                <span className="ml-2 shrink-0 self-center rounded border border-brand/30 bg-brand/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-brand">
                  Customer
                </span>
              </button>
            ))
          )}
        </motion.div>
      )}
    </div>
  );
}
