import { NextResponse, NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "./lib/auth/session-constants";
import { verifySessionTokenAsync } from "./lib/auth/session";

const publicPaths = [
  "/auth/login",
  "/auth/select-company",
  "/login",
  "/select-company",
  "/api/mobile",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/customers",
  "/api/company",
  "/api/cars",
  "/api/files",
  "/api/public",
  "/api/public/recovery-requests",
  "/api/public/estimate-approval",
  "/api/i18n-generate",
  "/api/yeastar",
  "/api/webhooks/dialer",
  "/api/webhooks/channels",
  "/api/global/call-center/incoming/stream",
  "/api/health",
  // Allow global lead APIs to be accessed without forcing login (used by public call center/global flows)
  "/api/global/leads",
  "/favicon.ico",
  "/_next",
  "/assets",
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

function unauthorized(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Authentication required" },
      { status: 401 }
    );
  }
  return redirectTo(req, "/auth/login");
}

function isTrustedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");

  if (!host) return false;
  const expectedOrigin = `${proto}://${host}`;

  try {
    if (origin) return new URL(origin).origin === expectedOrigin;
    if (referer) return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }

  // Allow requests that omit both headers to avoid breaking legitimate same-origin flows.
  return true;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return unauthorized(req);
  }

  const session = await verifySessionTokenAsync(token);
  if (!session) {
    const response = unauthorized(req);
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  if (
    pathname.startsWith("/api/") &&
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    !req.headers.get("authorization") &&
    !isTrustedOrigin(req)
  ) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
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
