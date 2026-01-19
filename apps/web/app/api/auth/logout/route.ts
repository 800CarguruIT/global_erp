import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "../../../../lib/auth/session";

function buildLogoutResponse(req: NextRequest) {
  const redirectUrl = new URL("/auth/login", req.url);
  const res = NextResponse.redirect(redirectUrl);
  clearSessionCookie(res);
  return res;
}

export async function POST(req: NextRequest) {
  return buildLogoutResponse(req);
}

export async function GET(req: NextRequest) {
  return buildLogoutResponse(req);
}
