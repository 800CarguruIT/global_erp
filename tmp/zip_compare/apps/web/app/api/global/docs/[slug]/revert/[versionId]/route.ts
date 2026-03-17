import { NextResponse, NextRequest } from "next/server";
import { revertDocVersionBySlug } from "../../../../../../../lib/docs-admin";

import { requireAuth } from "@/lib/auth/requireAuth";

export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string; versionId: string }> }
) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { slug, versionId } = await context.params;
  const result = await revertDocVersionBySlug(slug, versionId);
  if (!result.ok) {
    const status =
      result.error === "doc_not_found" || result.error === "version_not_found"
        ? 404
        : result.error === "docs_versions_unavailable"
        ? 503
        : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ data: result.doc });
}
