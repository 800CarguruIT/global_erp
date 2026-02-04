import Link from "next/link";

import { AppLayout, Card } from "@repo/ui";
import { listDocs } from "../../../lib/docs";

export const metadata = {
    title: "Global documentation",
    description: "Knowledge base for the Global ERP platform and services.",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
});

export default async function GlobalDocsPage() {
    const docs = await listDocs();

    return (
        <AppLayout>
            <div className="space-y-6 py-6">
                <header className="space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Documentation</p>
                    <h1 className="text-3xl font-semibold text-foreground">Global docs</h1>
                    <p className="text-sm text-muted-foreground max-w-2xl">
                        Store and share architecture overviews, API references, and operational notes for the Global ERP app. Add
                        Markdown files into the root `docs/` directory and they appear here automatically.
                    </p>
                </header>

                {docs.length === 0 ? (
                    <Card className="border-dashed border-muted-foreground/30 bg-background/70 p-6 text-sm text-muted-foreground">
                        No documentation exists yet. Drop Markdown files into the repo-wide `docs/` folder and reload.
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {docs.map((doc) => (
                            <Link href={`/global/docs/${doc.slug}`} key={doc.slug} className="group">
                                <Card className="h-full border transition hover:border-primary/60">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Updated {formatUpdatedAt(doc.updatedAt)}</span>
                                        <span className="text-primary transition group-hover:text-primary/80">Read</span>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                        <h2 className="text-lg font-semibold text-foreground">{doc.title}</h2>
                                        <p className="text-sm text-muted-foreground">
                                            {doc.excerpt || "Summary coming soon."}
                                        </p>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function formatUpdatedAt(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "Unknown";
    }
    return DATE_FORMATTER.format(parsed);
}

