"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@repo/ui";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

type UserRow = {
  id: string;
  email: string;
  full_name?: string | null;
  is_active: boolean;
  mobile?: string | null;
  dialer_location?: "inhouse" | "remote" | null;
};

export default function CompanyDialerExtensionsPage({ params }: Params) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [locationDraft, setLocationDraft] = useState<Record<string, "inhouse" | "remote" | "">>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return;
        const payload = await res.json().catch(() => ({}));
        if (!stop) setCurrentUserId(String(payload?.user?.id ?? payload?.userId ?? "") || null);
      } catch {
        // ignore profile load errors
      }
    })();
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    if (!companyId) return;
    let stop = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/admin/users?status=active&pageSize=500&department=RSA+Sales+Department`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load users");
        const payload = await res.json();
        const rows = (Array.isArray(payload?.data) ? payload.data : []) as UserRow[];
        if (stop) return;
        setUsers(rows);
        const initDraft: Record<string, string> = {};
        const initLocationDraft: Record<string, "inhouse" | "remote" | ""> = {};
        for (const user of rows) {
          initDraft[user.id] = String(user.mobile ?? "");
          initLocationDraft[user.id] = user.dialer_location ?? "";
        }
        setDraft(initDraft);
        setLocationDraft(initLocationDraft);
      } catch (err: any) {
        if (!stop) setError(err?.message ?? "Failed to load users");
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [companyId]);


  async function saveUserExtension(user: UserRow) {
    if (!companyId) return;
    setSavingId(user.id);
    setError(null);
    setNotice(null);
    try {
      const mobile = String(draft[user.id] ?? "").trim();
      const locVal = locationDraft[user.id] ?? "";
      const dialerLocation = locVal === "inhouse" || locVal === "remote" ? locVal : null;
      const res = await fetch(`/api/company/${companyId}/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          fullName: user.full_name ?? "",
          mobile: mobile || null,
          dialerLocation,
        }),
      });
      if (!res.ok) throw new Error("Failed to save extension");
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, mobile: mobile || null, dialer_location: dialerLocation } : u))
      );
      if (currentUserId && user.id === currentUserId && typeof window !== "undefined") {
        if (mobile) {
          window.localStorage.setItem("dialer_agent_extension", mobile);
          document.cookie = `dialer_agent_extension=${encodeURIComponent(
            mobile
          )}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
        } else {
          window.localStorage.removeItem("dialer_agent_extension");
          document.cookie = "dialer_agent_extension=; path=/; max-age=0; samesite=lax";
        }
      }
      setNotice(`Extension updated for ${user.full_name ?? user.email}`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save extension");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">Dialer User Extensions</h1>
            <p className="text-xs sm:text-sm opacity-70">
              Assign PBX extension for each company user. This extension is used to route incoming popups.
            </p>
          </div>
          {companyId ? (
            <Link
              href={`/company/${companyId}/integrations/dialer`}
              className="rounded-full border border-white/25 px-3 py-1 text-xs hover:border-white/60"
            >
              Back to Dialer
            </Link>
          ) : null}
        </div>

        {error ? <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">{error}</div> : null}
        {notice ? (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">{notice}</div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
          {loading ? (
            <div className="text-sm opacity-70">Loading users...</div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{user.full_name ?? "Unnamed User"}</div>
                    <div className="truncate text-xs opacity-70">{user.email}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Inhouse / Remote toggle */}
                    <div className="flex h-9 overflow-hidden rounded-lg border border-white/20 text-xs font-semibold">
                      {(["inhouse", "remote"] as const).map((opt) => {
                        const active = (locationDraft[user.id] ?? "") === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() =>
                              setLocationDraft((prev) => ({
                                ...prev,
                                [user.id]: active ? "" : opt,
                              }))
                            }
                            className={`px-3 capitalize transition-colors ${
                              active
                                ? opt === "inhouse"
                                  ? "bg-emerald-600/80 text-white"
                                  : "bg-blue-600/80 text-white"
                                : "bg-black/40 text-white/50 hover:text-white/80"
                            }`}
                          >
                            {opt === "inhouse" ? "In-house" : "Remote"}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      value={draft[user.id] ?? ""}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, [user.id]: e.target.value }))
                      }
                      placeholder="Extension e.g. 1010"
                      className="h-9 w-36 rounded-lg border border-white/20 bg-black/40 px-3 text-sm outline-none focus:border-white/50"
                    />
                    <button
                      type="button"
                      onClick={() => saveUserExtension(user)}
                      disabled={savingId === user.id}
                      className="h-9 rounded-lg border border-white/30 px-3 text-xs font-semibold uppercase tracking-wide hover:border-white/70 disabled:opacity-60"
                    >
                      {savingId === user.id ? "Saving" : "Save"}
                    </button>
                  </div>
                </div>
              ))}
              {users.length === 0 ? <div className="text-sm opacity-70">No active users found.</div> : null}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
