"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface Advisor {
  id: string;
  email: string;
  fullName: string;
  mobile: string | null;
  dialerLocation: string | null;
  employeeId: string | null;
  department: string | null;
}

export default function PisExtensionsPage() {
  const { companyId } = useParams();
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [locationDraft, setLocationDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const loadAdvisors = useCallback(async () => {
    try {
      const r = await fetch(`/api/company/${companyId}/admin/users?status=active&pageSize=500&department=${encodeURIComponent("Service Center Sales Department")}`);
      const data = await r.json();
      const users: Advisor[] = (data.data ?? data.users ?? []).map((u: any) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName ?? u.full_name ?? "",
        mobile: u.mobile ?? null,
        dialerLocation: u.dialerLocation ?? u.dialer_location ?? null,
        employeeId: u.employeeId ?? u.employee_id ?? null,
        department: u.department ?? null,
      }));
      setAdvisors(users);
      const d: Record<string, string> = {};
      const l: Record<string, string> = {};
      for (const u of users) {
        d[u.id] = u.mobile ?? "";
        l[u.id] = u.dialerLocation ?? "inhouse";
      }
      setDraft(d);
      setLocationDraft(l);
    } catch (e) {
      console.error("Failed to load advisors", e);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadAdvisors(); }, [loadAdvisors]);

  const saveUser = async (user: Advisor) => {
    setSaving(p => ({ ...p, [user.id]: true }));
    try {
      await fetch(`/api/company/${companyId}/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          fullName: user.fullName,
          mobile: draft[user.id] || null,
          dialerLocation: locationDraft[user.id] || null,
        }),
      });
      setSaved(p => ({ ...p, [user.id]: true }));
      setTimeout(() => setSaved(p => ({ ...p, [user.id]: false })), 2000);
    } catch (e) {
      console.error("Failed to save", e);
    }
    setSaving(p => ({ ...p, [user.id]: false }));
  };

  if (loading) return <div className="text-slate-400 py-8">Loading advisors...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Advisor Dialer Extensions</h2>
          <p className="text-xs text-slate-500">Assign dialer extensions and location (inhouse/remote) for service center advisors</p>
        </div>
        <span className="text-xs text-slate-500">{advisors.length} advisors</span>
      </div>

      <div className="rounded-xl border border-border bg-gradient-to-br from-slate-900/80 to-black/90 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">#</th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Advisor</th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Email</th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Extension</th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Location</th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Action</th>
            </tr>
          </thead>
          <tbody>
            {advisors.map((adv, i) => (
              <tr key={adv.id} className="border-b border-border/40 hover:bg-muted/40">
                <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-foreground">{adv.fullName}</td>
                <td className="px-4 py-3 text-slate-400">{adv.email}</td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={draft[adv.id] ?? ""}
                    onChange={e => setDraft(p => ({ ...p, [adv.id]: e.target.value }))}
                    placeholder="e.g. 1001"
                    className="w-28 rounded-lg bg-slate-800 border border-border px-3 py-1.5 text-xs text-foreground placeholder:text-slate-600 focus:border-amber-500/50 focus:outline-none"
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    value={locationDraft[adv.id] ?? "inhouse"}
                    onChange={e => setLocationDraft(p => ({ ...p, [adv.id]: e.target.value }))}
                    className="rounded-lg bg-slate-800 border border-border px-3 py-1.5 text-xs text-foreground focus:border-amber-500/50 focus:outline-none"
                  >
                    <option value="inhouse">Inhouse</option>
                    <option value="remote">Remote</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => saveUser(adv)}
                    disabled={saving[adv.id]}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-all ${
                      saved[adv.id]
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                    } disabled:opacity-50`}
                  >
                    {saving[adv.id] ? "Saving..." : saved[adv.id] ? "Saved" : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
