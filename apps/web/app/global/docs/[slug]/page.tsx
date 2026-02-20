import Link from "next/link";
import { notFound } from "next/navigation";

import { AppLayout, Card } from "@repo/ui";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { getDocBySlug } from "../../../../lib/docs";

export default async function DocDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDocBySlug(slug);
  if (!doc) {
    return notFound();
  }

  return (
    <AppLayout>
      <div className="space-y-6 py-6">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Documentation</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-foreground">{doc.title}</h1>
              <p className="text-sm text-muted-foreground">
                Updated {new Date(doc.updatedAt).toLocaleString()} | {doc.relativePath}
              </p>
            </div>
            <Link
              href="/global/docs"
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/40"
            >
              Back to docs
            </Link>
          </div>
        </header>

        <Card className="rounded-2xl border border-white/5 bg-background/80 p-6 shadow-lg">
          <MarkdownRenderer text={doc.content} />
        </Card>
      </div>
    </AppLayout>
  );
}
