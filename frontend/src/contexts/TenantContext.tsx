import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { fetchUserCustomers, fetchUsers, UserAdminResponse } from '../api/usersApi';
import { bootstrapMetrics } from '../lib/bootstrapMetrics';

interface TenantContextType {
  activeTenantId: number | undefined;
  setActiveTenantId: (id: number | undefined) => void;
  assignedCustomers: UserAdminResponse[];
  isLoadingAssignments: boolean;
  canSelectTenant: boolean;
  isSwitchingTenant: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const TENANT_FETCH_TIMEOUT_MS = 8000;

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeTenantId, setActiveTenantId] = useState<number | undefined>(undefined);
  const [assignedCustomers, setAssignedCustomers] = useState<UserAdminResponse[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [isSwitchingTenant, setIsSwitchingTenant] = useState(false);
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousUserIdRef = useRef<number | null>(null);
  const renderCountRef = useRef(0);
  const userId = user ? parseInt(user.id, 10) : null;
  const storageKey = userId ? `ics_active_tenant_${userId}` : null;

  renderCountRef.current += 1;
  console.debug(`[provider] TenantProvider render ${renderCountRef.current}`);

  useEffect(() => {
    console.info("[provider] TenantProvider mounted");
    return () => {
      console.info("[provider] TenantProvider unmounted");
    };
  }, []);

  const canSelectTenant = user?.role === 'admin' || user?.role === 'analyst' || user?.role === 'viewer';

  const setActiveTenant = useCallback((id: number | undefined) => {
    setActiveTenantId(id);
    if (storageKey) {
      if (typeof id === "number") {
        sessionStorage.setItem(storageKey, String(id));
      } else {
        sessionStorage.setItem(storageKey, "0"); // 0 represents Global View for admin
      }
    }
    setIsSwitchingTenant(true);
    if (switchTimerRef.current) {
      clearTimeout(switchTimerRef.current);
    }
    switchTimerRef.current = setTimeout(() => setIsSwitchingTenant(false), 450);
  }, [storageKey]);

  useEffect(() => {
    let isMounted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (previousUserIdRef.current && previousUserIdRef.current !== userId) {
      setAssignedCustomers([]);
      setActiveTenantId(undefined);
      setIsSwitchingTenant(false);
    }
    previousUserIdRef.current = userId;

    if (user && canSelectTenant) {
      const tenantStart = performance.now();
      console.groupCollapsed("[startup] tenant bootstrap");
      console.time("startup:tenant_fetch");
      setIsLoadingAssignments(true);
      bootstrapMetrics.startPhase("tenant_fetch");

      // Add timeout protection
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn("[TenantContext] Tenant fetch timed out after " + TENANT_FETCH_TIMEOUT_MS + "ms");
          setIsLoadingAssignments(false);
          bootstrapMetrics.endPhase("tenant_fetch", false, "timeout");
        }
      }, TENANT_FETCH_TIMEOUT_MS);

      const fetchAssignments = (isInitial = false) => {
        const fetchPromise = user?.role === 'admin'
          ? fetchUsers(undefined, 'customer').then(users => ({ assigned_customers: users }))
          : fetchUserCustomers(parseInt(user.id, 10));

        fetchPromise
          .then((res) => {
            if (!isMounted) return;
            if (isInitial && timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            
            setAssignedCustomers((prev) => {
              const prevIds = prev.map(c => c.id).sort().join(',');
              const newIds = res.assigned_customers.map(c => c.id).sort().join(',');
              if (prevIds !== newIds) {
                if (!isInitial) console.info("[TenantContext] Tenant assignments updated dynamically");
                return res.assigned_customers;
              }
              return prev;
            });

            if (isInitial) {
              bootstrapMetrics.endPhase("tenant_fetch", true);
              console.timeEnd("startup:tenant_fetch");
              console.info("[startup] tenant fetch ms", Math.round(performance.now() - tenantStart));
              console.groupEnd();
            }
          })
          .catch((err) => {
            if (!isMounted) return;
            if (isInitial && timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
              console.error("Failed to fetch assigned customers:", err);
              bootstrapMetrics.endPhase("tenant_fetch", false, err instanceof Error ? err.message : "unknown");
              console.timeEnd("startup:tenant_fetch");
              console.info("[startup] tenant fetch ms", Math.round(performance.now() - tenantStart));
              console.groupEnd();
            } else {
              console.error("Failed to poll assigned customers:", err);
            }
          })
          .finally(() => {
            if (isMounted && isInitial) {
              setIsLoadingAssignments(false);
            }
          });
      };

      fetchAssignments(true);
      
      // Poll every 30 seconds for dynamic assignment updates
      pollInterval = setInterval(() => fetchAssignments(false), 30000);

    } else {
      setAssignedCustomers([]);
      setActiveTenantId(undefined);
      setIsSwitchingTenant(false);
    }

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (pollInterval) clearInterval(pollInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, canSelectTenant]);

  useEffect(() => {
    if (!user || !canSelectTenant) return;
    
    if (assignedCustomers.length === 0) {
      if (activeTenantId !== undefined) {
        setActiveTenant(undefined);
      }
      return;
    }

    const storedId = storageKey ? Number(sessionStorage.getItem(storageKey)) : undefined;
    const hasStored = typeof storedId === "number" && !Number.isNaN(storedId);
    
    if (user?.role === 'admin') {
      if (hasStored && storedId !== 0 && assignedCustomers.some((c) => c.id === storedId)) {
        setActiveTenant(storedId);
      } else if (hasStored && storedId === 0) {
        if (activeTenantId !== undefined) setActiveTenant(undefined);
      } else {
        if (activeTenantId !== undefined) setActiveTenant(undefined); // Default to Global View
      }
      return;
    }

    // 1. Check if currently active is still valid (for analyst/viewer)
    if (activeTenantId !== undefined && assignedCustomers.some((c) => c.id === activeTenantId)) {
      return;
    }
    
    // 2. Check if stored is valid
    if (hasStored && storedId !== 0 && assignedCustomers.some((c) => c.id === storedId)) {
      setActiveTenant(storedId);
      return;
    }
    
    // 3. Default to first available
    setActiveTenant(assignedCustomers[0].id);
  }, [assignedCustomers, activeTenantId, setActiveTenant, user, canSelectTenant, storageKey]);

  useEffect(() => {
    return () => {
      if (switchTimerRef.current) {
        clearTimeout(switchTimerRef.current);
      }
    };
  }, []);

  const value = useMemo(() => ({
    activeTenantId,
    setActiveTenantId: setActiveTenant,
    assignedCustomers,
    isLoadingAssignments,
    canSelectTenant,
    isSwitchingTenant,
  }), [activeTenantId, assignedCustomers, isLoadingAssignments, canSelectTenant, isSwitchingTenant, setActiveTenant]);

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
