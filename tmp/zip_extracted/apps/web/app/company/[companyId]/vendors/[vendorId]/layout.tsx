import React from "react";
import { resolveScopeFromPath } from "../../../../../lib/scope/resolve-scope";
import { ScopeProvider } from "../../../../../context/scope/ScopeProvider";

export default async function VendorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string; vendorId: string }>;
}) {
  const { companyId, vendorId } = await params;
  const scope = resolveScopeFromPath(`/company/${companyId}/vendors/${vendorId}`);
  return <ScopeProvider value={scope}>{children}</ScopeProvider>;
}
