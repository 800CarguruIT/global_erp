import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { getLeadById } from "@repo/ai-core/crm/leads/repository";
import { randomBytes } from "crypto";

type Params = { params: Promise<{ companyId: string; id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
  const sql = getSql();

  const lead = await getLeadById(companyId, id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Check for existing token
  const existing = await sql`
    SELECT token FROM lead_share_tokens
    WHERE company_id = ${companyId} AND lead_id = ${id}
    ORDER BY created_at DESC LIMIT 1
  `;
  if (existing.length > 0) {
    const baseUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
    return NextResponse.json({ token: existing[0].token, url: `${baseUrl}/share/lead/${existing[0].token}` });
  }

  // Generate new token
  const token = randomBytes(16).toString("hex");
  await sql`
    INSERT INTO lead_share_tokens (company_id, lead_id, token)
    VALUES (${companyId}, ${id}, ${token})
  `;

  const baseUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return NextResponse.json({ token, url: `${baseUrl}/share/lead/${token}` });
}