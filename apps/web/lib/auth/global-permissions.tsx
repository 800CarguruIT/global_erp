"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { filterGlobalPermissionKeys } from "./global-permission-keys";

type GlobalPermissionsContextValue = {
  permissions: string[];
  loading: boolean;
  error: string | null;
  hasPermission: (keys: string | string[]) => boolean;
  hasAnyPermission: (keys: string[]) => boolean;
};

const GlobalPermissionsContext = createContext<GlobalPermissionsContextValue | null>(null);

export function GlobalPermissionsProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadPermissions() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/permissions/me?scope=global", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to load permissions");
        }
        const data = await res.json();
        const perms = Array.isArray(data?.permissions) ? data.permissions : [];
        if (!active) return;
        setPermissions(filterGlobalPermissionKeys(perms));
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? "Failed to load permissions");
        setPermissions([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    loadPermissions();
    return () => {
      active = false;
    };
  }, []);

  const hasAnyPermission = useCallback(
    (keys: string[]) => {
      if (!keys.length) return true;
      if (permissions.includes("global.admin")) return true;
      return keys.some((key) => permissions.includes(key));
    },
    [permissions]
  );

  const hasPermission = useCallback(
    (keys: string | string[]) => {
      const normalized = Array.isArray(keys) ? keys : [keys];
      if (!normalized.length) return true;
      return hasAnyPermission(normalized);
    },
    [hasAnyPermission]
  );

  const value = useMemo(
    () => ({
      permissions,
      loading,
      error,
      hasPermission,
      hasAnyPermission,
    }),
    [permissions, loading, error, hasPermission, hasAnyPermission]
  );

  return <GlobalPermissionsContext.Provider value={value}>{children}</GlobalPermissionsContext.Provider>;
}

export function useGlobalPermissions() {
  const ctx = useContext(GlobalPermissionsContext);
  if (!ctx) {
    throw new Error("useGlobalPermissions must be used within GlobalPermissionsProvider");
  }
  return ctx;
}
