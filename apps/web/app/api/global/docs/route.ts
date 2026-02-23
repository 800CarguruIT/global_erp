import { NextRequest, NextResponse } from "next/server";

import { createDoc } from "../../../../lib/docs-admin";
import { listDocs } from "../../../../lib/docs";

export async function GET() {
  const docs = await listDocs();
  return NextResponse.json({ data: docs });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { title?: string; section?: string; content?: string }
    | null;

  const result = await createDoc({
    title: body?.title ?? "",
    section: body?.section,
    content: body?.content,
  });

  if (!result.ok) {
    const status = result.error === "docs_table_unavailable" ? 503 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ data: result.doc }, { status: 201 });
}
