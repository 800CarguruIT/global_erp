import type { ScopeContext } from "@repo/ai-core/shared/scopes-and-modules";

export function resolveScopeFromPath(pathname: string): ScopeContext {
  // Branch (company + branches)
  const branchMatch = pathname.match(/^\/company\/([^/]+)\/branches\/([^/]+)/);
  if (branchMatch) {
    return {
      scope: "branch",
      companyId: branchMatch[1],
      branchId: branchMatch[2],
    };
  }

  // Vendor under company
  const companyVendorMatch = pathname.match(/^\/company\/([^/]+)\/vendors\/([^/]+)/);
  if (companyVendorMatch) {
    return {
      scope: "vendor",
      companyId: companyVendorMatch[1],
      vendorId: companyVendorMatch[2],
    };
  }

  // Top-level vendor route (if used)
  const vendorMatch = pathname.match(/^\/vendor\/([^/]+)/);
  if (vendorMatch) {
    return { scope: "vendor", vendorId: vendorMatch[1] };
  }

  // Global
  if (pathname.startsWith("/global")) {
    return { scope: "global" };
  }

  // Company
  const companyMatch = pathname.match(/^\/company\/([^/]+)/);
  if (companyMatch) {
    return { scope: "company", companyId: companyMatch[1] };
  }

  // Default to global
  return { scope: "global" };
}

export default resolveScopeFromPath;
