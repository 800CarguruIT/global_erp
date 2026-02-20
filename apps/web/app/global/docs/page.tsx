import Link from "next/link";

import { AppLayout, Card } from "@repo/ui";
import { listDocs } from "../../../lib/docs";

export const metadata = {
  title: "Global documentation",
  description: "Knowledge base for the Global ERP platform and services.",
};

function toSectionTitle(section: string) {
  if (section === "root") return "General";
  return section
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function GlobalDocsPage() {
  const docs = await listDocs();
  const grouped = new Map<string, typeof docs>();

  for (const doc of docs) {
    const list = grouped.get(doc.section) ?? [];
    list.push(doc);
    grouped.set(doc.section, list);
  }

  const sectionKeys = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));

  return (
    <AppLayout>
      <div className="space-y-6 py-6">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Documentation</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold text-foreground">Global docs</h1>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Browse all markdown documentation from `global/docs`. Files are grouped by their folder.
              </p>
            </div>
            <Link
              href="/global"
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/40"
            >
              Back to dashboard
            </Link>
          </div>
        </header>

        {docs.length === 0 ? (
          <Card className="border border-white/5 bg-background/80 p-6 text-sm text-muted-foreground">
            No documentation files found. Add markdown files under `global/docs`.
          </Card>
        ) : (
          <div className="space-y-8">
            {sectionKeys.map((sectionKey) => {
              const sectionDocs = (grouped.get(sectionKey) ?? []).sort((a, b) => a.title.localeCompare(b.title));
              return (
                <section
                  id={`section-${sectionKey}`}
                  key={sectionKey}
                  className="space-y-5 rounded-2xl border border-white/5 bg-background/80 p-6 shadow-lg"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Section</p>
                    <h2 className="text-2xl font-semibold text-foreground">{toSectionTitle(sectionKey)}</h2>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {sectionDocs.map((doc) => (
                      <Link key={doc.slug} href={`/global/docs/${doc.slug}`} className="group">
                        <Card className="h-full border border-white/5 transition hover:border-primary/60 hover:shadow-[0_20px_45px_-15px_rgba(12,17,43,0.8)]">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Updated {new Date(doc.updatedAt).toLocaleDateString()}</span>
                            <span className="text-primary transition group-hover:text-primary/80">Read</span>
                          </div>
                          <div className="mt-3 space-y-2">
                            <h3 className="text-lg font-semibold text-foreground">{doc.title}</h3>
                            <p className="text-sm text-muted-foreground">{doc.excerpt}</p>
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{doc.relativePath}</p>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
