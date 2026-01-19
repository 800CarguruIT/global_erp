import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ companyId: string; branchId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId, branchId } = await params;
  const { getSql } = await import("@repo/ai-core");
  const sql = getSql();
  try {
    const rows =
      await sql`SELECT id, category, entry_type, description, amount, status, due_date, created_at
                FROM branch_accounting_entries
                WHERE company_id = ${companyId} AND branch_id = ${branchId}
                ORDER BY created_at DESC`;
    const data = rows.map((r: any) => ({
      id: r.id,
      category: r.category,
      type: r.entry_type,
      description: r.description,
      amount: Number(r.amount),
      status: r.status,
      dueDate: r.due_date ? new Date(r.due_date).toISOString().slice(0, 10) : null,
      createdAt: r.created_at,
    }));
    return NextResponse.json({ data });
  } catch (err) {
    console.error("Branch accounting summary error", err);
    return NextResponse.json({ error: "Failed to load accounting summary" }, { status: 500 });
  }
}
