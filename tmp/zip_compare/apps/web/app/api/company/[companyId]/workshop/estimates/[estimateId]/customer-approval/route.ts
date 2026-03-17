import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string; estimateId: string }> };

function baseUrlFromReq(req: NextRequest): string {
  const envBase =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (envBase) return envBase.replace(/\/+$/, "");
  return req.nextUrl.origin.replace(/\/+$/, "");
}

function generateToken() {
  return randomBytes(24).toString("hex");
}

type CustomerApprovalMeta = {
  token?: string;
  status?: "pending" | "approved";
  expiresAt?: string;
  sharedAt?: string;
  lastSharedAt?: string;
  shareCount?: number;
  approvedAt?: string;
  selectedItemIds?: string[];
  termsAccepted?: boolean;
  signatureDataUrl?: string;
  customerName?: string;
};

const ESTIMATE_APPROVAL_EXPIRY_DAYS = 7;

function addDaysIso(baseIso: string, days: number): string {
  const base = new Date(baseIso);
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return next.toISOString();
}

function isExpired(expiresAt?: string | null): boolean {
  const raw = String(expiresAt ?? "").trim();
  if (!raw) return false;
  const time = new Date(raw).getTime();
  if (!Number.isFinite(time)) return false;
  return time < Date.now();
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, estimateId } = await params;
  const sql = getSql();
  const rows = await sql`
    SELECT id, meta
    FROM estimates
    WHERE company_id = ${companyId}
      AND id = ${estimateId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }
  const meta = (row.meta ?? {}) as Record<string, unknown>;
  const customerApproval = (meta.customerEstimateApproval ?? {}) as CustomerApprovalMeta;
  const token = String(customerApproval.token ?? "").trim();
  const url = token ? `${baseUrlFromReq(req)}/estimate-approval/${encodeURIComponent(token)}` : null;
  return NextResponse.json({
    data: {
      token: token || null,
      url,
      status: customerApproval.status ?? "pending",
      expiresAt: customerApproval.expiresAt ?? null,
      isExpired: isExpired(customerApproval.expiresAt ?? null),
      sharedAt: customerApproval.sharedAt ?? null,
      approvedAt: customerApproval.approvedAt ?? null,
    },
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, estimateId } = await params;
  const body = await req.json().catch(() => ({}));
  const regenerate = Boolean(body?.regenerate);
  const sql = getSql();
  const rows = await sql`
    SELECT id, meta
    FROM estimates
    WHERE company_id = ${companyId}
      AND id = ${estimateId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const meta = (row.meta ?? {}) as Record<string, any>;
  const current = (meta.customerEstimateApproval ?? {}) as CustomerApprovalMeta;
  const currentToken = String(current.token ?? "").trim();
  const token = !regenerate && currentToken ? currentToken : generateToken();
  const expiresAt = addDaysIso(nowIso, ESTIMATE_APPROVAL_EXPIRY_DAYS);

  const nextApproval: CustomerApprovalMeta = {
    ...current,
    token,
    status: "pending",
    expiresAt,
    sharedAt: current.sharedAt ?? nowIso,
    lastSharedAt: nowIso,
    shareCount: Number(current.shareCount ?? 0) + 1,
    approvedAt: undefined,
    selectedItemIds: regenerate ? [] : current.selectedItemIds ?? [],
    termsAccepted: regenerate ? false : Boolean(current.termsAccepted),
    signatureDataUrl: regenerate ? undefined : current.signatureDataUrl,
    customerName: regenerate ? undefined : current.customerName,
  };
  const nextMeta = {
    ...meta,
    customerEstimateApproval: nextApproval,
  };

  await sql`
    UPDATE estimates
    SET meta = ${nextMeta as any}::jsonb,
        updated_at = now()
    WHERE company_id = ${companyId}
      AND id = ${estimateId}
  `;

  const url = `${baseUrlFromReq(req)}/estimate-approval/${encodeURIComponent(token)}`;
  return NextResponse.json({
    data: {
      token,
      url,
      status: nextApproval.status ?? "pending",
      expiresAt: nextApproval.expiresAt ?? null,
      isExpired: isExpired(nextApproval.expiresAt ?? null),
      sharedAt: nextApproval.sharedAt ?? null,
      lastSharedAt: nextApproval.lastSharedAt ?? null,
      shareCount: nextApproval.shareCount ?? 1,
    },
  });
}
