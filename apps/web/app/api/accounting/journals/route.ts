import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Accounting } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../lib/auth/permissions";

const lineSchema = z.object({
  accountId: z.string(),
  description: z.string().optional().nullable(),
  debit: z.number().optional(),
  credit: z.number().optional(),
  dimensions: z
    .object({
      companyId: z.string().optional().nullable(),
      branchId: z.string().optional().nullable(),
      vendorId: z.string().optional().nullable(),
      employeeId: z.string().optional().nullable(),
      projectId: z.string().optional().nullable(),
      costCenter: z.string().optional().nullable(),
    })
    .optional(),
});

const journalSchema = z.object({
  scope: z.enum(["global", "company"]),
  companyId: z.string().optional().nullable(),
  journalType: z.string(),
  date: z.string(),
  description: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  currency: z.string().optional().nullable(),
  lines: z.array(lineSchema).min(2),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as "global" | "company";
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
    const dateTo = url.searchParams.get("dateTo") ?? undefined;

    const permResp = await requirePermission(
      req,
      "accounting.view",
      buildScopeContextFromRoute({ companyId }, scope)
    );
    if (permResp) return permResp;

    const journals = await Accounting.listEntityJournals({
      scope,
      companyId,
      dateFrom: dateFrom ?? undefined,
      dateTo: dateTo ?? undefined,
    });
    return NextResponse.json({ data: journals });
  } catch (error) {
    console.error("GET /api/accounting/journals error:", error);
    return NextResponse.json({ error: "Failed to load journals" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = journalSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const permResp = await requirePermission(
      req,
      "accounting.post",
      buildScopeContextFromRoute({ companyId: body.companyId ?? undefined }, body.scope)
    );
    if (permResp) return permResp;

    const entityId = await Accounting.resolveEntityId(body.scope, body.companyId ?? null);
    const posted = await Accounting.postJournal({
      entityId,
      journalType: body.journalType,
      date: body.date,
      description: body.description ?? null,
      reference: body.reference ?? null,
      currency: body.currency ?? undefined,
      lines: body.lines,
    });
    return NextResponse.json(posted, { status: 201 });
  } catch (error) {
    console.error("POST /api/accounting/journals error:", error);
    return NextResponse.json({ error: "Failed to post journal" }, { status: 500 });
  }
}
