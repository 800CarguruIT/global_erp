import Link from "next/link";

import { AppLayout, Card } from "@repo/ui";
import { listDocs } from "../../../lib/docs";
import { DOCUMENTATION_STRUCTURE } from "@repo/ui/docs/docsStructure";

export const metadata = {
  title: "Global documentation",
  description: "Knowledge base for the Global ERP platform and services.",
};

export default async function GlobalDocsPage() {
  const docs = await listDocs();
  const docMap = new Map(docs.map((entry) => [entry.slug, entry]));
  const globalSubtitles = ["Users Management", "Roles and Permissions", "Companies", "Settings"];

  return (
    <AppLayout>
      <div className="space-y-6 py-6">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Documentation</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold text-foreground">Global docs</h1>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Navigate the reference handbook for Global ERP. The documentation is organized by chapter - Global, Company,
                Workshop (third-party), and Vendors - with focused sessions on user management, roles, integrations, and partner portals.
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                {globalSubtitles.map((subtitle) => (
                  <span key={subtitle} className="rounded-full border border-white/10 px-2 py-0.5">
                    {subtitle}
                  </span>
                ))}
              </div>
            </div>
            <Link
              href="/global"
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/40"
            >
              Back to dashboard
            </Link>
          </div>
        </header>

        <div className="space-y-8">
          {DOCUMENTATION_STRUCTURE.map((chapter) => (
            <section
              id={`chapter-${chapter.key}`}
              key={chapter.key}
              className="space-y-5 rounded-2xl border border-white/5 bg-background/80 p-6 shadow-lg"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">{chapter.tagline}</p>
                  <h2 className="text-2xl font-semibold text-foreground">{chapter.title}</h2>
                  <p className="text-sm text-muted-foreground max-w-2xl">{chapter.description}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {chapter.sessions.map((session) => {
                  const doc = docMap.get(session.slug);
                  return (
                    <Link key={session.slug} href={`/global/docs/${session.slug}`} className="group">
                      <Card className="h-full border border-white/5 transition hover:border-primary/60 hover:shadow-[0_20px_45px_-15px_rgba(12,17,43,0.8)]">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{doc ? `Updated ${new Date(doc.updatedAt).toLocaleDateString()}` : "Coming soon"}</span>
                          <span className="text-primary transition group-hover:text-primary/80">Read</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          <h3 className="text-lg font-semibold text-foreground">{doc ? doc.title : session.title}</h3>
                          <p className="text-sm text-muted-foreground">{doc?.excerpt ?? session.description}</p>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
