import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "../../../../lib/auth/session";

function clearAuthCookies(res: NextResponse) {
  clearSessionCookie(res);
  res.cookies.set("dialer_agent_extension", "", { path: "/", maxAge: 0 });
}

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ success: true });
  clearAuthCookies(res);
  return res;
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
