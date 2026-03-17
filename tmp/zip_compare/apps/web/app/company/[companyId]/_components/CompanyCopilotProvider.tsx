"use client";

import React from "react";
import { StaffCopilot } from "@repo/ui";
import { usePathname, useRouter } from "next/navigation";

export function CompanyCopilotProvider({
  companyId,
  children,
}: {
  companyId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Derive current page context from pathname
  const page = derivePageContext(pathname);
  const branchId = extractBranchId(pathname);

  return (
    <>
      {children}
      <StaffCopilot
        companyId={companyId}
        currentPage={page}
        branchId={branchId}
        onNavigate={(href) => router.push(href)}
      />
    </>
  );
}

function derivePageContext(pathname: string): string {
  if (pathname.includes("/revenue-dashboard")) return "revenue";
  if (pathname.includes("/analytics")) return "analytics";
  if (pathname.includes("/leads")) return "leads";
  if (pathname.includes("/call-center")) return "call-center";
  if (pathname.includes("/marketing")) return "marketing";
  if (pathname.includes("/workshop") || pathname.includes("/job-cards") || pathname.includes("/jobs")) return "workshop";
  if (pathname.includes("/inventory")) return "inventory";
  if (pathname.includes("/accounting")) return "accounting";
  if (pathname.includes("/hr")) return "hr";
  if (pathname.includes("/branches/") && pathname.match(/\/branches\/[^/]+\/?$/)) return "branch-dashboard";
  return "company-dashboard";
}

function extractBranchId(pathname: string): string | undefined {
  const match = pathname.match(/\/branches\/([^/]+)/);
  return match?.[1];
}
