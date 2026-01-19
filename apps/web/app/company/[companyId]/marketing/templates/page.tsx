"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppLayout, Card } from "@repo/ui";

type TabId = "whatsapp" | "email";

type TemplateRow = {
  id: string;
  type: TabId;
  name: string;
  status: string;
  provider_key: string;
  provider_status: string | null;
  published_at: string | null;
  created_at: string;
  content: Record<string, unknown>;
};

export default function CompanyMarketingTemplatesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ companyId: string }>();
  const companyId = params?.companyId ?? "";
  const [activeTab, setActiveTab] = useState<TabId>("whatsapp");
  const [waTemplates, setWaTemplates] = useState<TemplateRow[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TemplateRow | null>(null);
  const [testModal, setTestModal] = useState<TemplateRow | null>(null);
  const [testNumber, setTestNumber] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "email" || tab === "whatsapp") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  function updateTab(next: TabId) {
    setActiveTab(next);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", next);
    const nextUrl = companyId
      ? `/company/${companyId}/marketing/templates?${nextParams.toString()}`
      : `/marketing/templates?${nextParams.toString()}`;
    router.replace(nextUrl);
  }

  async function loadTemplates(type: TabId) {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/marketing/templates?type=${type}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load templates");
      }
      const data = await res.json();
      if (type === "whatsapp") {
        setWaTemplates(data.items ?? []);
      } else {
        setEmailTemplates(data.items ?? []);
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!companyId) return;
    loadTemplates(activeTab);
  }, [companyId, activeTab]);

  async function publishTemplate(item: TemplateRow) {
    if (!companyId) return;
    setPublishingId(item.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/company/${companyId}/marketing/templates/${item.id}/publish`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to publish template");
      }
      const updated = body.item as TemplateRow;
      if (updated.type === "whatsapp") {
        setWaTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        setEmailTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to publish template");
    } finally {
      setPublishingId(null);
    }
  }

  async function deleteTemplate(item: TemplateRow) {
    if (!companyId) return;
    setDeletingId(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/marketing/templates/${item.id}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to delete template");
      }
      if (item.type === "whatsapp") {
        setWaTemplates((prev) => prev.filter((t) => t.id !== item.id));
      } else {
        setEmailTemplates((prev) => prev.filter((t) => t.id !== item.id));
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  }

  async function sendTestMessage() {
    if (!companyId || !testModal || !testNumber.trim()) return;
    setTestSending(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/company/${companyId}/marketing/templates/${testModal.id}/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: testNumber.trim() }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to send test");
      }
      setTestResult("Test message sent.");
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to send test");
    } finally {
      setTestSending(false);
    }
  }

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleString() : "-";

  const waRows = useMemo(
    () =>
      waTemplates.map((tpl) => ({
        ...tpl,
        language: String(tpl.content?.language ?? "-"),
        category: String(tpl.content?.category ?? "-"),
      })),
    [waTemplates]
  );

  const emailRows = useMemo(
    () =>
      emailTemplates.map((tpl) => ({
        ...tpl,
        subject: String(tpl.content?.subject ?? "-"),
        from: String(tpl.content?.from ?? "-"),
      })),
    [emailTemplates]
  );

  const newHref = companyId
    ? `/company/${companyId}/marketing/templates/new?type=${activeTab}`
    : "#";

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Manage approved messaging templates for WhatsApp (Meta) and Email (AWS).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className={
              activeTab === "whatsapp"
                ? "rounded-full border border-primary px-3 py-1 text-xs text-primary"
                : "rounded-full border border-white/10 px-3 py-1 text-xs hover:border-primary"
            }
            onClick={() => updateTab("whatsapp")}
            type="button"
          >
            WhatsApp (Meta)
          </button>
          <button
            className={
              activeTab === "email"
                ? "rounded-full border border-primary px-3 py-1 text-xs text-primary"
                : "rounded-full border border-white/10 px-3 py-1 text-xs hover:border-primary"
            }
            onClick={() => updateTab("email")}
            type="button"
          >
            Email (AWS SES)
          </button>
        </div>

        {error && (
          <div className="text-xs sm:text-sm text-red-400 border border-red-400/40 rounded-lg px-3 py-2 bg-red-500/5">
            {error}
          </div>
        )}

        {activeTab === "whatsapp" ? (
          <Card>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-semibold">WhatsApp templates</div>
                <div className="text-xs text-muted-foreground">{waRows.length} total</div>
              </div>
              <button
                className="rounded-full bg-primary px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90"
                onClick={() => router.push(newHref)}
              >
                + New WhatsApp template
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Language</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Provider status</th>
                    <th className="px-3 py-2">Published</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {waRows.map((tpl) => (
                    <tr key={tpl.id} className="border-b border-white/5">
                      <td className="px-3 py-2 font-medium">{tpl.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{tpl.language}</td>
                      <td className="px-3 py-2 text-muted-foreground">{tpl.category}</td>
                      <td className="px-3 py-2 text-muted-foreground">{tpl.provider_key}</td>
                      <td className="px-3 py-2 text-muted-foreground">{tpl.status}</td>
                      <td className="px-3 py-2 text-muted-foreground">{tpl.provider_status ?? "-"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {formatDate(tpl.published_at)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {formatDate(tpl.created_at)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          className="rounded-full border border-white/10 px-2 py-1 text-xs hover:border-primary disabled:opacity-50"
                          disabled={!!tpl.published_at || publishingId === tpl.id || loading}
                          onClick={() => publishTemplate(tpl)}
                        >
                          {publishingId === tpl.id ? "Publishing..." : "Submit to Meta"}
                        </button>
                        <button
                          className="ml-2 rounded-full border border-white/10 px-2 py-1 text-xs hover:border-primary"
                          onClick={() => {
                            setTestModal(tpl);
                            setTestNumber("");
                            setTestResult(null);
                          }}
                        >
                          Send test
                        </button>
                        <button
                          className="ml-2 rounded-full border border-white/10 px-2 py-1 text-xs hover:border-primary"
                          onClick={() =>
                            router.push(`/company/${companyId}/marketing/templates/${tpl.id}/edit`)
                          }
                        >
                          Edit
                        </button>
                        <button
                          className="ml-2 rounded-full border border-red-300/30 px-2 py-1 text-xs text-red-200 hover:border-red-300/60 disabled:opacity-50"
                          disabled={deletingId === tpl.id}
                          onClick={() => setConfirmDelete(tpl)}
                        >
                          {deletingId === tpl.id ? "Deleting..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {waRows.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-sm text-muted-foreground" colSpan={9}>
                        {loading ? "Loading..." : "No WhatsApp templates yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-semibold">Email templates</div>
                <div className="text-xs text-muted-foreground">{emailRows.length} total</div>
              </div>
              <button
                className="rounded-full bg-primary px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90"
                onClick={() => router.push(newHref)}
              >
                + New Email template
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">From</th>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Provider status</th>
                    <th className="px-3 py-2">Published</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emailRows.map((tpl) => (
                    <tr key={tpl.id} className="border-b border-white/5">
                      <td className="px-3 py-2 font-medium">{tpl.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{tpl.from}</td>
                      <td className="px-3 py-2 text-muted-foreground">{tpl.subject}</td>
                      <td className="px-3 py-2 text-muted-foreground">{tpl.provider_key}</td>
                      <td className="px-3 py-2 text-muted-foreground">{tpl.status}</td>
                      <td className="px-3 py-2 text-muted-foreground">{tpl.provider_status ?? "-"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {formatDate(tpl.published_at)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {formatDate(tpl.created_at)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          className="rounded-full border border-white/10 px-2 py-1 text-xs hover:border-primary disabled:opacity-50"
                          disabled={!!tpl.published_at || publishingId === tpl.id || loading}
                          onClick={() => publishTemplate(tpl)}
                        >
                          {publishingId === tpl.id ? "Publishing..." : "Publish to AWS"}
                        </button>
                        <button
                          className="ml-2 rounded-full border border-white/10 px-2 py-1 text-xs hover:border-primary"
                          onClick={() =>
                            router.push(`/company/${companyId}/marketing/templates/${tpl.id}/edit`)
                          }
                        >
                          Edit
                        </button>
                        <button
                          className="ml-2 rounded-full border border-red-300/30 px-2 py-1 text-xs text-red-200 hover:border-red-300/60 disabled:opacity-50"
                          disabled={deletingId === tpl.id}
                          onClick={() => setConfirmDelete(tpl)}
                        >
                          {deletingId === tpl.id ? "Deleting..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {emailRows.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-sm text-muted-foreground" colSpan={9}>
                        {loading ? "Loading..." : "No email templates yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-background p-5">
              <div className="text-lg font-semibold">Delete template?</div>
              <div className="mt-2 text-sm text-muted-foreground">
                This will delete the template locally and trigger a provider delete for{" "}
                {confirmDelete.provider_key.toUpperCase()}.
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  className="rounded-full border border-white/10 px-4 py-2 text-sm"
                  onClick={() => setConfirmDelete(null)}
                  disabled={deletingId === confirmDelete.id}
                >
                  Cancel
                </button>
                <button
                  className="rounded-full border border-red-300/30 px-4 py-2 text-sm text-red-200 hover:border-red-300/60 disabled:opacity-50"
                  onClick={() => deleteTemplate(confirmDelete)}
                  disabled={deletingId === confirmDelete.id}
                >
                  {deletingId === confirmDelete.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
        {testModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-background p-5">
              <div className="text-lg font-semibold">Send test message</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Enter a WhatsApp number (with country code) to send a test message.
              </div>
              <div className="mt-4 space-y-2">
                <input
                  className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                  placeholder="+971500000000"
                />
                {testResult && <div className="text-xs text-emerald-300">{testResult}</div>}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  className="rounded-full border border-white/10 px-4 py-2 text-sm"
                  onClick={() => setTestModal(null)}
                  disabled={testSending}
                >
                  Close
                </button>
                <button
                  className="rounded-full border border-white/10 px-4 py-2 text-sm hover:border-primary disabled:opacity-50"
                  onClick={sendTestMessage}
                  disabled={testSending || !testNumber.trim()}
                >
                  {testSending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
