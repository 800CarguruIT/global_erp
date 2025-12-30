import { NextResponse, NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "./lib/auth/session-constants";

const publicPaths = [
  "/auth/login",
  "/auth/select-company",
  "/login",
  "/select-company",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/customers",
  "/api/company",
  "/api/cars",
  "/api/i18n-generate",
  // Allow global lead APIs to be accessed without forcing login (used by public call center/global flows)
  "/api/global/leads",
  "/favicon.ico",
  "/_next",
  "/assets",
];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(p));
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
    return redirectTo(req, "/auth/login");
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
