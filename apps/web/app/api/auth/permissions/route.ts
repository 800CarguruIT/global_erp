import { NextResponse } from "next/server";
import { Rbac } from "@repo/ai-core";

export async function GET() {
  try {
    const perms = await Rbac.getAllPermissions();
    return NextResponse.json({ data: perms });
  } catch (error) {
    console.error("GET /api/auth/permissions error:", error);
    return NextResponse.json({ error: "Failed to load permissions" }, { status: 500 });
  }
}
