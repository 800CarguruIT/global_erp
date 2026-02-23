import { NextResponse } from "next/server";
import { publishDocVersionBySlug } from "../../../../../../../lib/docs-admin";

export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string; versionId: string }> }
) {
  const { slug, versionId } = await context.params;
  const result = await publishDocVersionBySlug(slug, versionId);
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
