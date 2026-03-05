import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "../../../../lib/auth/session";

function clearAuthCookies(res: NextResponse) {
  clearSessionCookie(res);
  res.cookies.set("dialer_agent_extension", "", { path: "/", maxAge: 0 });
}

function getPublicBaseUrl(req: NextRequest) {
  const envBase =
    process.env.NEXT_PUBLIC_WEB_BASE_URL ||
    process.env.WEB_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL;
  if (envBase) return envBase.trim().replace(/\/+$/, "");
  return req.nextUrl.origin;
}

function buildLogoutRedirectResponse(req: NextRequest) {
  const base = getPublicBaseUrl(req);
  const redirectUrl = new URL("/auth/login", base);
  const res = NextResponse.redirect(redirectUrl);
  clearAuthCookies(res);
  return res;
}

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ success: true });
  clearAuthCookies(res);
  return res;
}

export async function GET(req: NextRequest) {
  return buildLogoutRedirectResponse(req);
}
