"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { filterGlobalPermissionKeys } from "./global-permission-keys";

type GlobalPermissionsContextValue = {
  permissions: string[];
  loading: boolean;
  error: string | null;
  ensureLoaded: () => Promise<void>;
  hasPermission: (keys: string | string[]) => boolean;
  hasAnyPermission: (keys: string[]) => boolean;
};

const GlobalPermissionsContext = createContext<GlobalPermissionsContextValue | null>(null);

export function GlobalPermissionsProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const loadedRef = useRef(false);
  const loadingRef = useRef(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current || loadingRef.current) return;
    loadingRef.current = true;
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const res = await fetch("/api/auth/permissions/me?scope=global", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to load permissions");
      }
      const data = await res.json().catch(() => ({}));
      const perms = Array.isArray(data?.permissions) ? data.permissions : [];
      if (!mountedRef.current) return;
      setPermissions(filterGlobalPermissionKeys(perms));
      loadedRef.current = true;
    } catch (err: any) {
      if (!mountedRef.current) return;
      setError(err?.message ?? "Failed to load permissions");
      setPermissions([]);
      loadedRef.current = true;
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
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
      ensureLoaded,
      hasPermission,
      hasAnyPermission,
    }),
    [permissions, loading, error, ensureLoaded, hasPermission, hasAnyPermission]
  );

  return <GlobalPermissionsContext.Provider value={value}>{children}</GlobalPermissionsContext.Provider>;
}

export function useGlobalPermissions() {
  const ctx = useContext(GlobalPermissionsContext);
  useEffect(() => {
    void ctx?.ensureLoaded();
  }, [ctx]);
  if (!ctx) {
    throw new Error("useGlobalPermissions must be used within GlobalPermissionsProvider");
  }
  return ctx;
}
