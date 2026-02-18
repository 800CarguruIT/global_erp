import { NextRequest, NextResponse } from "next/server";
import { Accounting } from "@repo/ai-core";
import { getSql } from "@repo/ai-core/db";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

type Params = { params: { companyId: string } };

type AccountDto = {
  id: string;
  code: string;
  name: string;
  type: string;
  subType: string | null;
  normalBalance: string;
  standardId?: string | null;
  isActive: boolean;
  isLeaf: boolean;
};

type AccountRowLike = {
  id: string;
  code: string;
  name: string;
  type: string;
  sub_type?: string | null;
  normal_balance?: string | null;
  standard_id?: string | null;
  is_active?: boolean | null;
  is_leaf?: boolean | null;
  parent_id?: string | null;
  company_id?: string | null;
};

function mapAccount(a: AccountRowLike): AccountDto {
  return {
    id: a.id,
    code: a.code,
    name: a.name,
    type: a.type,
    subType: a.sub_type ?? null,
    normalBalance: a.normal_balance ?? "debit",
    standardId: a.standard_id ?? null,
    isActive: a.is_active ?? true,
    isLeaf: a.is_leaf ?? true,
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const perm = await requirePermission(req, "accounting.view", buildScopeContextFromRoute({ companyId }, "company"));
  if (perm) return perm;

  try {
    const sql = getSql();
    const leafOnly = req.nextUrl.searchParams.get("leafOnly") === "1";
    const activeOnly = req.nextUrl.searchParams.get("activeOnly") === "1";
    const all = await sql<AccountRowLike[]>`
      SELECT
        id,
        COALESCE(NULLIF(code, ''), NULLIF(account_code, ''), '') AS code,
        COALESCE(NULLIF(name, ''), NULLIF(account_name, ''), '') AS name,
        COALESCE(type, 'asset') AS type,
        sub_type,
        normal_balance,
        standard_id,
        is_active,
        is_leaf,
        parent_id,
        company_id
      FROM accounting_accounts
      WHERE company_id IS NULL OR company_id = ${companyId}
      ORDER BY COALESCE(NULLIF(code, ''), NULLIF(account_code, ''), ''), COALESCE(NULLIF(name, ''), NULLIF(account_name, ''), '')
    `;
    const active = all.filter((a) => (activeOnly ? a?.is_active !== false : true));

    let filtered = active;
    if (leafOnly) {
      const parentIds = new Set(active.map((a) => a.parent_id).filter((id): id is string => Boolean(id)));
      filtered = active.filter((account) => {
        const normalizedCode = String(account.code ?? "").replace(/[^0-9A-Za-z]/g, "");
        const isSummaryCode = normalizedCode.length <= 4;
        const hasChildByParent = parentIds.has(account.id);
        const hasChildByCodePrefix = active.some(
          (other) => other.id !== account.id && typeof other.code === "string" && other.code.startsWith(account.code)
            && other.code.length > account.code.length
        );
        return !isSummaryCode && !hasChildByParent && !hasChildByCodePrefix;
      });
    }

    return NextResponse.json({ data: filtered.map(mapAccount) });
  } catch (error) {
    console.error("GET /api/company/[companyId]/accounting/accounts error", error);
    return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const perm = await requirePermission(req, "accounting.post", buildScopeContextFromRoute({ companyId }, "company"));
  if (perm) return perm;

  try {
    const body = await req.json();
    const action = body?.action as string;

    if (action === "importStandard") {
      const accounts = await Accounting.createOrImportEntityChart("company", companyId);
      return NextResponse.json({
        message: "Standard accounts imported",
        data: accounts.map(mapAccount),
      });
    }

    if (action === "create") {
      const code = String(body?.code ?? "").trim();
      const name = String(body?.name ?? "").trim();
      const type = String(body?.type ?? "").trim();
      const normalBalance = String(body?.normalBalance ?? "").trim().toLowerCase();
      const subType = body?.subType ? String(body.subType).trim() : null;

      if (!code || !name || !type || !["debit", "credit"].includes(normalBalance)) {
        return NextResponse.json({ error: "Invalid account payload" }, { status: 400 });
      }

      const entityId = await Accounting.resolveEntityId("company", companyId);
      const created = await Accounting.createAccountForEntity({
        entityId,
        code,
        name,
        type,
        subType,
        normalBalance: normalBalance as "debit" | "credit",
      });

      return NextResponse.json({ data: mapAccount(created), message: "Account created" });
    }

    if (action === "map") {
      const accountId = String(body?.accountId ?? "").trim();
      const standardId = body?.standardId ? String(body.standardId).trim() : null;
      if (!accountId) {
        return NextResponse.json({ error: "accountId is required" }, { status: 400 });
      }
      const updated = await Accounting.mapAccountToStandard(accountId, standardId);
      if (!updated) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }
      return NextResponse.json({ data: mapAccount(updated), message: "Mapping updated" });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/company/[companyId]/accounting/accounts error", error);
    return NextResponse.json({ error: "Failed to update accounts" }, { status: 500 });
  }
}
