import { notFound } from "next/navigation";

import { AppLayout } from "@repo/ui";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { DocTabs } from "./DocTabs";
import { getDocBySlug, listDocs } from "../../../../lib/docs";

export const dynamic = "force-static";

export async function generateStaticParams() {
  const docs = await listDocs();
  return docs.map((doc) => ({ slug: doc.slug }));
}

const TECHNICAL_SECTIONS = {
  api: [
    {
      title: "GET /api/admin/users",
      body: "Returns the paginated list of global admins. Accepts filters for status and role, and enforces `global.admin` scope via middleware.",
    },
    {
      title: "POST /api/admin/users",
      body: "Creates a new global user. Payload includes `email`, `roles`, and optional `employee_id`. The endpoint issues an invitation email and writes the hashed password immediately if provided.",
    },
    {
      title: "PATCH /api/admin/users/:id/status",
      body: "Flips `is_active` or updates other metadata. This is the API invoked by the sidebar’s toggle and emits audit logs for every transition.",
    },
    {
      title: "POST /api/auth/invite/global",
      body: "Reuses the global invite pipeline when an admin is created from the UI, ensuring the onboarding token attaches to the `global_users` record.",
    },
  ],
  database: [
    {
      title: "global_users",
      body: "Primary table that drives the Global Users screen. Key columns: `id`, `email`, `full_name`, `password_hash`, `is_active`, `roles` (JSON), and `created_at` metadata.",
    },
    {
      title: "global_user_roles",
      body: "Maps pre-defined permissions to each global account and serves the Roles & Permissions dashboard when scoping company access.",
    },
    {
      title: "audit_logs",
      body: "Stores every admin change (creation, status toggle, password reset) for Security Monitoring so the UI can show the ‘Last login’ badge and history.",
    },
  ],
};

export default async function DocDetailPage({ params }: { params: { slug: string } }) {
  const doc = await getDocBySlug(params.slug);
  if (!doc) {
    return notFound();
  }

  const overviewContent = (
    <div className="space-y-5">
      <MarkdownRenderer text={doc.content} />
    </div>
  );

  const techContent = (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-foreground">API & Endpoints</h2>
        <div className="mt-2 space-y-4">
          {TECHNICAL_SECTIONS.api.map((entry) => (
            <article key={entry.title} className="rounded-2xl border border-white/5 bg-background/70 p-4 text-sm leading-relaxed text-foreground">
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{entry.title}</p>
              <p className="mt-1">{entry.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Database & Storage</h2>
        <div className="mt-2 space-y-4">
          {TECHNICAL_SECTIONS.database.map((entry) => (
            <article key={entry.title} className="rounded-2xl border border-white/5 bg-background/70 p-4 text-sm leading-relaxed text-foreground">
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{entry.title}</p>
              <p className="mt-1">{entry.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Diagrams & Flow</h2>
        <div className="mt-2 space-y-3 rounded-2xl border border-white/5 bg-background/70 p-4 text-sm text-foreground">
          <p>
            Global user changes flow through the API into `global_users`, trigger audit_logs, and cascade to company/branch permissions via the `global_user_roles` join table.
            The UI uses this flow to keep the Global Users table, Status toggle, and the Roles & Permissions screen synchronized, while each request passes through the shared
            `requirePermission` middleware so only `global.admin` actors ever mutate the data.
          </p>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Diagram</p>
          <p>
            [Global UI] → [`POST /api/auth/invite/global`] → [global_users + global_user_roles] → [audit_logs] → [Security Monitoring].
            Status toggles reuse `PATCH /api/admin/users/:id/status`, updating the badge state before the response refreshes the table.
          </p>
        </div>
      </section>
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6 py-6">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Documentation</p>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold text-foreground">{doc.title}</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              This chapter walks through the lifecycle of global administrators, covering how they are created, how roles gate access, and how the
              platform keeps passwords and audit trails in sync.
            </p>
          </div>
        </header>

        <DocTabs overview={overviewContent} tech={techContent} />
      </div>
    </AppLayout>
  );
}
