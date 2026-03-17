import { NextRequest } from "next/server";
import { z } from "zod";
import { CallCenter, getSql } from "@repo/ai-core";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

const bodySchema = z.object({
  fromNumber: z.string().optional().nullable(),
  toNumber: z.string().min(1),
  toEntityType: z.enum(["customer", "employee", "vendor", "other"]).optional().nullable(),
  toEntityId: z.string().optional().nullable(),
  providerKey: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

async function resolveActiveDialerProvider(companyId: string): Promise<string | null> {
  const sql = getSql();
  const rows = await sql<{ provider: string; company_id: string | null }[]>`
    SELECT provider, company_id
    FROM integration_dialers
    WHERE is_active = TRUE
      AND (company_id = ${companyId} OR company_id IS NULL)
    ORDER BY CASE WHEN company_id = ${companyId} THEN 0 ELSE 1 END, updated_at DESC, created_at DESC
    LIMIT 1
  `;
  const one = ((rows as any).rows ?? rows)?.[0];
  if (!one?.provider) return null;
  return String(one.provider).trim().toLowerCase() || null;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return createMobileErrorResponse("Invalid payload", 400, {
        details: parsed.error.format(),
      });
    }

    const requestedProvider = String(parsed.data.providerKey ?? "").trim().toLowerCase();
    const providerKey =
      requestedProvider || (await resolveActiveDialerProvider(companyId)) || "yeastar";

    const session = await CallCenter.startOutboundCall({
      scope: "company",
      companyId,
      branchId: null,
      createdByUserId: userId,
      fromNumber: parsed.data.fromNumber ?? "",
      toNumber: parsed.data.toNumber,
      toEntityType: parsed.data.toEntityType ?? null,
      toEntityId: parsed.data.toEntityId ?? null,
      providerKey,
      metadata: parsed.data.metadata ?? {},
    });

    return createMobileSuccessResponse({ session }, 201);
  } catch (error) {
    console.error(
      "POST /api/mobile/company/[companyId]/call-center/call error:",
      error,
    );
    return handleMobileError(error);
  }
}
