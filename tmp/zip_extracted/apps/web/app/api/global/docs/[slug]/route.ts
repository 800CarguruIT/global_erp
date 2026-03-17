import { NextRequest, NextResponse } from "next/server";

import { deleteDocBySlug, updateDocBySlug } from "../../../../../lib/docs-admin";
import { getDocBySlug } from "../../../../../lib/docs";

import { requireAuth } from "@/lib/auth/requireAuth";

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { slug } = await context.params;
  const doc = await getDocBySlug(slug);
  if (!doc) {
    return NextResponse.json({ error: "doc_not_found" }, { status: 404 });
  }
  return NextResponse.json({ data: doc });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { slug } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | { title?: string; section?: string; content?: string; changeType?: "major" | "minor" | "patch"; changelog?: string }
    | null;

  const result = await updateDocBySlug(slug, {
    title: body?.title,
    section: body?.section,
    content: body?.content,
    changeType: body?.changeType,
    changelog: body?.changelog,
  });

  if (!result.ok) {
    const status =
      result.error === "doc_not_found" ? 404 : result.error === "docs_table_unavailable" ? 503 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ data: result.doc });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { slug } = await context.params;
  const result = await deleteDocBySlug(slug);

  if (!result.ok) {
    const status =
      result.error === "doc_not_found" ? 404 : result.error === "docs_table_unavailable" ? 503 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ data: result.deleted });
}
