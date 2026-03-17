import React from "react";
import { resolveScopeFromPath } from "../../../../../lib/scope/resolve-scope";
import { ScopeProvider } from "../../../../../context/scope/ScopeProvider";

export default async function BranchLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string; branchId: string }>;
}) {
  const { companyId, branchId } = await params;
  const scope = resolveScopeFromPath(`/company/${companyId}/branches/${branchId}`);
  return <ScopeProvider value={scope}>{children}</ScopeProvider>;
}
