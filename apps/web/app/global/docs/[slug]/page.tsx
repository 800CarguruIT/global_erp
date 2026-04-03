import { notFound } from "next/navigation";

import { AppLayout, Card } from "@repo/ui";
import { MarkdownRenderer, slugifyHeading } from "../components/MarkdownRenderer";
import { getDocBySlug } from "../../../../lib/docs";
import { DocActions } from "./DocActions";
import { DocVersionHistory } from "./DocVersionHistory";

type DocHeading = {
  level: number;
  text: string;
  id: string;
};

function extractDocHeadings(content: string): DocHeading[] {
  const lines = content.split(/\r?\n/);
  const headings: DocHeading[] = [];

  for (const line of lines) {
    const match = line.trim().match(/^(#{1,3})\s+(.*)$/);
    if (!match) continue;

    const level = match[1].length;
    const text = match[2].trim();
    const id = slugifyHeading(text);
    if (!id) continue;
    headings.push({
      level,
      text,
      id,
    });
  }

  return headings;
}

export default async function DocDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDocBySlug(slug);
  if (!doc) {
    return notFound();
  }
  const headings = extractDocHeadings(doc.content);
  const topics = headings.filter((heading) => heading.level >= 2);
  const visibleTopics = topics.length > 0 ? topics : headings.slice(0, 1);
  const breadcrumbLabel = doc.section === "root" ? "Docs" : doc.section;

  return (
    <AppLayout>
      <div className="space-y-5 py-4 lg:py-6">
        <header className="rounded-2xl border border-border bg-background/80 p-4 shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Documentation</p>
              <h1 className="text-3xl font-semibold text-foreground">{doc.title}</h1>
              <p className="text-sm text-muted-foreground">Updated {new Date(doc.updatedAt).toLocaleString()}</p>
              {doc.currentVersionLabel ? (
                <p className="text-xs uppercase tracking-[0.12em] text-emerald-200/90">
                  Version v{doc.currentVersionLabel}
                </p>
              ) : null}
            </div>
            <div className="space-y-2 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <span className="opacity-70">Global</span> / <span className="opacity-90">{breadcrumbLabel}</span>
              </p>
              <DocActions slug={slug} title={doc.title} />
            </div>
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="rounded-2xl border border-border bg-background/80 p-0 shadow-lg">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-xl font-semibold text-foreground">Overview</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">{doc.relativePath}</p>
            </div>
            <div className="p-6">
              <MarkdownRenderer text={doc.content} />
            </div>
          </Card>

          <aside className="xl:sticky xl:top-6">
            <Card className="rounded-2xl border border-border bg-background/80 p-4 shadow-lg">
              <div className="mb-3 border-b border-border pb-3">
                <h3 className="text-xl font-semibold text-foreground">Topics</h3>
              </div>
              {visibleTopics.length > 0 ? (
                <div className="space-y-2">
                  {visibleTopics.map((topic) => (
                    <a
                      key={topic.id}
                      href={`#${topic.id}`}
                      className="block rounded-xl border border-border bg-card/30 px-3 py-2 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary"
                    >
                      {topic.text}
                    </a>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No section headings found in this document.</p>}
            </Card>
            <DocVersionHistory slug={slug} />
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
