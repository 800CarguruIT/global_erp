import { NextRequest, NextResponse } from "next/server";
import { Accounting } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";
import { getCurrentUserIdFromRequest } from "../../../../../../lib/auth/current-user";

type Params = { params: Promise<{ companyId: string }> };
type JournalParams = { params: Promise<{ companyId: string; id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const perm = await requirePermission(req, "accounting.view", buildScopeContextFromRoute({ companyId }, "company"));
  if (perm) return perm;

  try {
    const journals = await Accounting.listEntityJournals({ scope: "company", companyId });
    return NextResponse.json({ data: journals });
  } catch (error) {
    console.error("GET /api/company/[companyId]/accounting/journals error", error);
    return NextResponse.json({ error: "Failed to load journals" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const perm = await requirePermission(req, "accounting.post", buildScopeContextFromRoute({ companyId }, "company"));
  if (perm) return perm;

  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "At least one line required" }, { status: 400 });
  }
  const date = body.date ?? new Date().toISOString().slice(0, 10);
  const entityId = await Accounting.resolveEntityId("company", companyId);
  try {
    const journal = await Accounting.createDraftJournal({
      entityId,
      date,

      description: body.description ?? null,
      journalType: body.journalType ?? "general",
      lines: body.lines.map((l: any) => ({
        accountId: l.accountId,
        debit: Number(l.debit ?? 0),
        credit: Number(l.credit ?? 0),
        description: l.description ?? null,
        lineNo: l.lineNo ?? undefined,
        employeeId: userId,
      })),
      skipAccountValidation: true,
      createdByUserId: userId,
    });
    return NextResponse.json({ data: journal }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/company/[companyId]/accounting/journals error", error);
    return NextResponse.json({ error: error?.message ?? "Failed to create journal" }, { status: 400 });
  }
}
