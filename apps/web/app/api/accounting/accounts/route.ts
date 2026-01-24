import { NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";

export async function GET(request: Request) {
  try {
    const sql = getSql();
    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
    }
    const rows = await sql<
      Array<{
        id: string;
        heading_id: string;
        subheading_id: string;
        group_id: string;
        company_id: string;
        account_code: string;
        account_name: string;
      }>
    >`
      SELECT id, heading_id, subheading_id, group_id, company_id, account_code, account_name
      FROM accounting_accounts
      WHERE company_id = ${companyId}
      ORDER BY account_code
    `;
    const data =
      rows?.map((row) => ({
        id: row.id,
        headingId: row.heading_id,
        subheadingId: row.subheading_id,
        groupId: row.group_id,
        companyId: row.company_id,
        accountCode: row.account_code,
        accountName: row.account_name,
      })) ?? [];
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/accounting/accounts error", error);
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const sql = getSql();
    const body = await request.json();
    const {
      groupId,
      companyId,
      accountCode,
      accountName,
    }: {
      groupId?: string;
      companyId?: string;
      accountCode?: string;
      accountName?: string;
    } = body ?? {};

    if (!groupId || !companyId || !accountCode || !accountName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [group] = await sql<
      Array<{
        id: string;
        heading_id: string;
        subheading_id: string;
        company_id: string;
      }>
    >`
      SELECT id, heading_id, subheading_id, company_id
      FROM accounting_groups
      WHERE id = ${groupId} AND company_id = ${companyId}
      LIMIT 1
    `;
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const [heading] = await sql<
      Array<{
        head_code: string;
      }>
    >`
      SELECT head_code
      FROM accounting_headings
      WHERE id = ${group.heading_id}
      LIMIT 1
    `;

    const [entity] = await sql<
      Array<{
        id: string;
      }>
    >`
      SELECT id
      FROM accounting_entities
      WHERE scope = 'company' AND company_id = ${companyId}
      LIMIT 1
    `;
    if (!entity) {
      return NextResponse.json({ error: "Company entity not found" }, { status: 400 });
    }

    const type =
      heading?.head_code === "2" || heading?.head_code === "3" || heading?.head_code === "4"
        ? "credit"
        : "debit";
    const typeLabel =
      heading?.head_code === "1"
        ? "asset"
        : heading?.head_code === "2"
        ? "liability"
        : heading?.head_code === "3"
        ? "equity"
        : heading?.head_code === "4"
        ? "income"
        : "expense";

    const rows = await sql<
      Array<{
        id: string;
        heading_id: string;
        subheading_id: string;
        group_id: string;
        company_id: string;
        account_code: string;
        account_name: string;
      }>
    >`
      INSERT INTO accounting_accounts (
        entity_id,
        heading_id,
        subheading_id,
        group_id,
        company_id,
        account_code,
        account_name,
        code,
        name,
        type,
        normal_balance,
        is_leaf,
        is_active
      )
      VALUES (
        ${entity.id},
        ${group.heading_id},
        ${group.subheading_id},
        ${group.id},
        ${companyId},
        ${accountCode},
        ${accountName},
        ${accountCode},
        ${accountName},
        ${typeLabel},
        ${type},
        true,
        true
      )
      RETURNING id, heading_id, subheading_id, group_id, company_id, account_code, account_name
    `;

    const row = rows?.[0];
    if (!row) {
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        id: row.id,
        headingId: row.heading_id,
        subheadingId: row.subheading_id,
        groupId: row.group_id,
        companyId: row.company_id,
        accountCode: row.account_code,
        accountName: row.account_name,
      },
    });
  } catch (error) {
    console.error("POST /api/accounting/accounts error", error);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const sql = getSql();
    const body = await request.json();
    const {
      accountId,
      targetGroupId,
      companyId,
    }: {
      accountId?: string;
      targetGroupId?: string;
      companyId?: string;
    } = body ?? {};

    if (!accountId || !targetGroupId || !companyId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [account] = await sql<
      Array<{
        id: string;
        company_id: string;
      }>
    >`
      SELECT id, company_id
      FROM accounting_accounts
      WHERE id = ${accountId} AND company_id = ${companyId}
      LIMIT 1
    `;
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const [group] = await sql<
      Array<{
        id: string;
        heading_id: string;
        subheading_id: string;
        company_id: string;
        group_code: string;
      }>
    >`
      SELECT id, heading_id, subheading_id, company_id, group_code
      FROM accounting_groups
      WHERE id = ${targetGroupId} AND company_id = ${companyId}
      LIMIT 1
    `;
    if (!group) {
      return NextResponse.json({ error: "Target group not found" }, { status: 404 });
    }

    const [maxRow] = await sql<{ max_code: string | null }[]>`
      SELECT MAX(account_code) AS max_code
      FROM accounting_accounts
      WHERE company_id = ${companyId} AND group_id = ${group.id}
    `;
    const maxCode = maxRow?.max_code ?? null;
    const nextCode = maxCode
      ? String(Number.parseInt(maxCode, 10) + 1)
      : `${group.group_code}01`;

    const [row] = await sql<
      Array<{
        id: string;
        heading_id: string;
        subheading_id: string;
        group_id: string;
        company_id: string;
        account_code: string;
        account_name: string;
      }>
    >`
      UPDATE accounting_accounts
      SET heading_id = ${group.heading_id},
          subheading_id = ${group.subheading_id},
          group_id = ${group.id},
          account_code = ${nextCode},
          code = ${nextCode}
      WHERE id = ${accountId} AND company_id = ${companyId}
      RETURNING id, heading_id, subheading_id, group_id, company_id, account_code, account_name
    `;

    if (!row) {
      return NextResponse.json({ error: "Failed to move account" }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        id: row.id,
        headingId: row.heading_id,
        subheadingId: row.subheading_id,
        groupId: row.group_id,
        companyId: row.company_id,
        accountCode: row.account_code,
        accountName: row.account_name,
      },
    });
  } catch (error) {
    console.error("PATCH /api/accounting/accounts error", error);
    return NextResponse.json({ error: "Failed to move account" }, { status: 500 });
  }
}
