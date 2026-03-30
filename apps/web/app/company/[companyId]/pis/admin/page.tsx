"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const SECTIONS = [
  { key: "score_weights", label: "Score Weights", desc: "Composite score formula weights (must sum to ~100)" },
  { key: "tier_boundaries", label: "Tier Boundaries", desc: "Minimum composite score for each tier" },
  { key: "commission_rates", label: "Commission Rates", desc: "Commission percentages and FOC penalties" },
  { key: "sla_thresholds", label: "SLA Thresholds", desc: "SLA targets for each funnel stage" },
  { key: "lead_distribution", label: "Lead Distribution", desc: "Accept windows, lock duration, penalties" },
  { key: "revenue_targets", label: "Revenue Targets", desc: "Monthly revenue and GP targets" },
];

export default function PisAdminPage() {
  const { companyId } = useParams();
  const [config, setConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => { fetch(`/api/company/${companyId}/pis/admin/config`).then(r => r.json()).then(setConfig).catch(console.error).finally(() => setLoading(false)); }, [companyId]);

  const saveConfig = async (key: string) => {
    setSaving(key);
    try {
      const value = JSON.parse(editValue);
      await fetch(`/api/company/${companyId}/pis/admin/config`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
      setConfig(prev => ({ ...prev, [key]: value }));
      setEditKey(null);
    } catch { alert("Invalid JSON"); }
    setSaving(null);
  };

  if (loading) return <div className="text-slate-400 py-8">Loading admin config...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-white">PIS Admin Configuration</h2>
      <div className="space-y-4">
        {SECTIONS.map(s => (
          <div key={s.key} className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-black/90 p-5">
            <div className="flex items-center justify-between mb-3">
              <div><h3 className="text-sm font-bold text-white">{s.label}</h3><p className="text-[11px] text-slate-500">{s.desc}</p></div>
              <button onClick={() => { setEditKey(editKey === s.key ? null : s.key); setEditValue(JSON.stringify(config[s.key] ?? {}, null, 2)); }}
                className="text-xs text-amber-400 hover:text-amber-300">{editKey === s.key ? "Cancel" : "Edit"}</button>
            </div>
            {editKey === s.key ? (
              <div className="space-y-2">
                <textarea value={editValue} onChange={e => setEditValue(e.target.value)}
                  className="w-full h-40 rounded-lg bg-slate-900 border border-white/20 p-3 text-xs font-mono text-slate-200" />
                <button onClick={() => saveConfig(s.key)} disabled={saving === s.key}
                  className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {saving === s.key ? "Saving..." : "Save"}</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {Object.entries(config[s.key] ?? {}).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-800/50 p-2">
                    <div className="text-[10px] text-slate-500">{k.replace(/_/g, " ")}</div>
                    <div className="text-sm font-semibold text-white">{String(v)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}