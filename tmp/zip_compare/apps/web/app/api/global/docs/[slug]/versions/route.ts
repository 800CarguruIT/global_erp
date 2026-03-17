import { NextRequest, NextResponse } from "next/server";

import { createDocVersionBySlug, listDocVersions } from "../../../../../../lib/docs-admin";

import { requireAuth } from "@/lib/auth/requireAuth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { slug } = await context.params;
  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit = Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 50;
  const result = await listDocVersions(slug, limit);
  if (!result.ok) {
    if (result.error === "docs_versions_unavailable") {
      return NextResponse.json({ data: [], unavailable: true });
    }
    const status = result.error === "doc_not_found" ? 404 : result.error === "docs_versions_unavailable" ? 503 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ data: result.versions });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { slug } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        section?: string;
        content?: string;
        changelog?: string;
        changeType?: "major" | "minor" | "patch";
        publish?: boolean;
      }
    | null;

  const result = await createDocVersionBySlug(slug, {
    title: body?.title,
    section: body?.section,
    content: body?.content,
    changelog: body?.changelog,
    changeType: body?.changeType,
    publish: Boolean(body?.publish),
  });

  if (!result.ok) {
    const status =
      result.error === "doc_not_found" ? 404 : result.error === "docs_versions_unavailable" ? 503 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ data: { doc: result.doc, version: result.version } }, { status: 201 });
}
