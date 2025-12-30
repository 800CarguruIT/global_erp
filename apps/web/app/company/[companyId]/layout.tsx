import React from "react";
import { resolveScopeFromPath } from "../../../lib/scope/resolve-scope";
import { ScopeProvider } from "../../../context/scope/ScopeProvider";

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const scope = resolveScopeFromPath(`/company/${companyId}`);
  return <ScopeProvider value={scope}>{children}</ScopeProvider>;
}
