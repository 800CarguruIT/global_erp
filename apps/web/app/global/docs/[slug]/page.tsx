import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AppLayout } from "@repo/ui";
import { getDocBySlug } from "../../../../lib/docs";
import { MarkdownRenderer } from "../components/MarkdownRenderer";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
});

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const doc = await getDocBySlug(params.slug);
    if (!doc) {
        return { title: "Documentation" };
    }

    return {
        title: doc.title,
        description: doc.excerpt || "Global ERP documentation",
    };
}

export default async function DocDetailPage({ params }: { params: { slug: string } }) {
    const doc = await getDocBySlug(params.slug);
    if (!doc) {
        notFound();
    }

    return (
        <AppLayout>
            <div className="space-y-6 py-6">
                <header className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Documentation</p>
                            <h1 className="text-3xl font-semibold text-foreground">{doc.title}</h1>
                            <p className="text-sm text-muted-foreground">Updated {formatUpdatedAt(doc.updatedAt)}</p>
                        </div>
                        <Link
                            href="/global/docs"
                            className="text-sm font-medium text-primary underline-offset-4 transition hover:text-primary/80"
                        >
                            Back to docs
                        </Link>
                    </div>
                </header>

                <div className="rounded-2xl border border-muted-foreground/30 bg-background/70 p-6 shadow-sm">
                    <MarkdownRenderer text={doc.content} />
                </div>
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

