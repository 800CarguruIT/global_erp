import { NextResponse, NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "./lib/auth/session-constants";

// Only truly public paths that require NO authentication at all.
// All other routes require at least a valid session cookie.
// Routes with their own auth (e.g. /api/company/* with requirePermission)
// still enforce fine-grained access internally.
const publicPaths = [
  // Auth pages & endpoints
  "/auth/login",
  "/auth/select-company",
  "/login",
  "/select-company",
  "/api/auth/login",
  "/api/auth/logout",
  // Mobile uses its own JWT auth (not session cookies)
  "/api/mobile",
  // Genuinely public endpoints (no auth required by design)
  "/api/public/recovery-requests",
  "/api/public/pre-inspection",
  "/api/public/estimate-approval",
  // Webhook receivers (use provider-specific signature verification)
  "/api/webhooks/dialer",
  "/api/webhooks/channels",
  // Static assets
  "/favicon.ico",
  "/_next",
  "/assets",
  // Public pages
  "/pre-inspection",
  "/estimate-approval",
];

function isPublicPath(pathname: string): boolean {
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p))) {
    return true;
  }
  if (/^\/company\/[^/]+\/recovery-requests\/[^/]+\/?$/.test(pathname)) {
    return true;
  }
  return false;
}

function redirectTo(req: NextRequest, path: string) {
  const url = req.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    // Return 401 JSON for API routes instead of redirecting
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    return redirectTo(req, "/auth/login");
  }

  const branchPathMatch = pathname.match(/^\/branches\/([^/]+)(\/.*)?$/);
  if (branchPathMatch) {
    const branchId = branchPathMatch[1];
    const suffix = branchPathMatch[2] ?? "";
    if (suffix.startsWith("/branches")) {
      return NextResponse.next();
    }
    const lastBranchPath = req.cookies.get("last_branch_path")?.value;
    const lastMatch = lastBranchPath?.match(/^\/company\/([^/]+)\/branches\/([^/]+)/);
    const companyId = lastMatch?.[1];
    const cookieBranchId = lastMatch?.[2];
    if (companyId && cookieBranchId && branchId === cookieBranchId) {
      const url = req.nextUrl.clone();
      url.pathname = `/company/${companyId}/branches/${branchId}${suffix}`;
      return NextResponse.rewrite(url);
    }
  }

  // Lightweight redirect rules without hitting DB in middleware.
  if (pathname === "/") {
    return redirectTo(req, "/global");
  }
  if (pathname.startsWith("/auth/select-company")) {
    return NextResponse.next();
  }
  // Allow all authenticated users to proceed; fine-grained scope enforcement happens in routes/services.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
