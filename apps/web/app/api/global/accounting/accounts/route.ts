import { NextRequest, NextResponse } from "next/server";
import { Accounting } from "@repo/ai-core/server";

type AccountDto = {
  id: string;
  code: string;
  name: string;
  type: string;
  subType: string | null;
  normalBalance: string;
  standardId?: string | null;
  isActive: boolean;
};

function mapAccount(a: any): AccountDto {
  return {
    id: a.id,
    code: a.code,
    name: a.name,
    type: a.type,
    subType: a.sub_type ?? null,
    normalBalance: a.normal_balance ?? "debit",
    standardId: a.standard_id ?? null,
    isActive: a.is_active ?? true,
  };
}

export async function GET() {
  try {
    const accounts = await Accounting.createOrImportEntityChart("global");
    return NextResponse.json({ data: accounts.map(mapAccount) });
  } catch (error) {
    console.error("GET /api/global/accounting/accounts error", error);
    return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action as string;

    if (action === "importStandard") {
      const accounts = await Accounting.createOrImportEntityChart("global");
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

      const entityId = await Accounting.resolveEntityId("global");
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
    console.error("POST /api/global/accounting/accounts error", error);
    return NextResponse.json({ error: "Failed to update accounts" }, { status: 500 });
  }
}
