import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "@/lib/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const start = Date.now();
  const checks: Record<string, { status: "ok" | "error"; ms?: number; error?: string }> = {};

  // Database check
  try {
    const dbStart = Date.now();
    const sql = getSql();
    await sql`SELECT 1 AS ping`;
    checks.database = { status: "ok", ms: Date.now() - dbStart };
  } catch (err: any) {
    checks.database = { status: "error", error: err?.message ?? "Database unreachable" };
  }

  // OpenAI check (non-blocking). Do not reveal secret/config details in public health output.
  const hasAiKey = Boolean(process.env.OPENAI_API_KEY);
  checks.ai = { status: hasAiKey ? "ok" : "error" };

  // Environment check. Keep this coarse so the endpoint does not disclose exact missing variables.
  const requiredEnvs = ["DATABASE_URL", "AUTH_SECRET"];
  const missingEnvs = requiredEnvs.filter((key) => !process.env[key]);
  checks.environment = missingEnvs.length === 0
    ? { status: "ok" }
    : { status: "error" };

  const allHealthy = Object.values(checks).every((c) => c.status === "ok");
  const statusCode = allHealthy ? 200 : 503;
  const isAuthenticated = Boolean(await getCurrentUserIdFromRequest(req));

  if (!isAuthenticated) {
    return NextResponse.json(
      {
        status: allHealthy ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        responseMs: Date.now() - start,
      },
      { status: statusCode }
    );
  }

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      responseMs: Date.now() - start,
      checks,
      version: process.env.npm_package_version ?? "0.1.0",
    },
    { status: statusCode }
  );
}
