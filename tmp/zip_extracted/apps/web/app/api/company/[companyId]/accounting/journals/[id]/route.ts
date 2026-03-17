import { NextRequest, NextResponse } from "next/server";
import { Accounting } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";
import { getCurrentUserIdFromRequest } from "../../../../../../../lib/auth/current-user";

type Params = { params: Promise<{ companyId: string; id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
  const perm = await requirePermission(req, "accounting.view", buildScopeContextFromRoute({ companyId }, "company"));
  if (perm) return perm;

  try {
    const journal = await Accounting.getJournalWithLines(id);
    return NextResponse.json({ data: journal });
  } catch (error) {
    console.error("GET /api/company/[companyId]/accounting/journals/[id] error", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
  const perm = await requirePermission(req, "accounting.post", buildScopeContextFromRoute({ companyId }, "company"));
  if (perm) return perm;

  try {
    const journal = await Accounting.markJournalAsPosted(id);
    return NextResponse.json({ data: journal });
  } catch (error) {
    console.error("PATCH /api/company/[companyId]/accounting/journals/[id] error", error);
    return NextResponse.json({ error: "Failed to post journal" }, { status: 400 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
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
    const journal = await Accounting.updateDraftJournal({
      journalId: id,
      entityId,
      journalType: body.journalType ?? "general",
      date,
      description: body.description ?? null,
      lines: body.lines.map((l: any) => ({
        accountId: l.accountId,
        debit: Number(l.debit ?? 0),
        credit: Number(l.credit ?? 0),
        description: l.description ?? null,
        dimensions: l.dimensions ?? undefined,
      })),
      skipAccountValidation: true,
      createdByUserId: userId,
    });
    return NextResponse.json({ data: journal });
  } catch (error: any) {
    console.error("PUT /api/company/[companyId]/accounting/journals/[id] error", error);
    return NextResponse.json({ error: error?.message ?? "Failed to update journal" }, { status: 400 });
  }
}
