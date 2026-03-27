import { NextRequest } from "next/server";
import { CustomerDataCenter } from "@repo/ai-core/server";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import { resolveDataCenterAccess } from "@/lib/data-center/access";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };
type Segment = "chsc" | "non_chsc" | "insurance" | "warranty" | "unknown";

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeSegment(value: string | null | undefined): Segment | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "chsc") return "chsc";
  if (v === "non_chsc" || v === "non-chsc") return "non_chsc";
  if (v === "insurance") return "insurance";
  if (v === "warranty" || v === "battery-warranty") return "warranty";
  if (v === "unknown") return "unknown";
  return undefined;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);
    const access = await resolveDataCenterAccess(userId, companyId);

    const url = new URL(req.url);
    const to = parseDate(url.searchParams.get("to")) ?? new Date();
    const from = parseDate(url.searchParams.get("from")) ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const segment = normalizeSegment(url.searchParams.get("segment"));

    const supervisorUserId =
      access.scope === "supervisor" ? access.supervisorUserId : undefined;
    const agentUserId = access.scope === "agent" ? access.agentUserId : undefined;

    const [kpis, report] = await Promise.all([
      CustomerDataCenter.getKpis({
        companyId,
        from,
        to,
        segment,
        supervisorUserId,
        agentUserId,
      }),
      CustomerDataCenter.getAgentsReport({
        companyId,
        from,
        to,
        segment,
        supervisorUserId,
        agentUserId,
      }),
    ]);

    return createMobileSuccessResponse({
      kpis,
      period: { from: report.from, to: report.to },
      topAgents: report.rows.slice(0, 10),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (message.includes("from must be before to")) {
      return createMobileErrorResponse(message, 400);
    }
    console.error("GET /api/mobile/company/[companyId]/data-center/overview error:", error);
    return handleMobileError(error);
  }
}
