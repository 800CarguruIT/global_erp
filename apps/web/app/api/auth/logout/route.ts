import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "../../../../lib/auth/session";

function buildLogoutResponse(req: NextRequest) {
  const reqUrl = new URL(req.url);
  const host = reqUrl.hostname;
  if (host === "0.0.0.0" || host === "127.0.0.1") {
    reqUrl.hostname = "localhost";
  }
  const redirectUrl = new URL("/auth/login", reqUrl);
  const res = NextResponse.redirect(redirectUrl);
  clearSessionCookie(res);
  res.cookies.set("dialer_agent_extension", "", { path: "/", maxAge: 0 });
  return res;
}

export async function POST(req: NextRequest) {
  return buildLogoutResponse(req);
}

export async function GET(req: NextRequest) {
  return buildLogoutResponse(req);
}
