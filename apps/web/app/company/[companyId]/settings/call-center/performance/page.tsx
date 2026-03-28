"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Thresholds {
  badge_excellent_min: number;
  badge_good_min: number;
  badge_average_min: number;
  held_rate_green_min: number;
  held_rate_amber_min: number;
  weight_held_rate: number;
  weight_chsc_conversion: number;
  weight_revenue_per_call: number;
  weight_appointments: number;
  target_chsc_loyalty_pct: number;
  target_appointment_show_pct: number;
  target_callback_rate_pct: number;
  alert_held_rate_gap_pp: number;
}

const DEFAULTS: Thresholds = {
  badge_excellent_min: 85,
  badge_good_min: 70,
  badge_average_min: 50,
  held_rate_green_min: 80,
  held_rate_amber_min: 50,
  weight_held_rate: 40,
  weight_chsc_conversion: 25,
  weight_revenue_per_call: 20,
  weight_appointments: 15,
  target_chsc_loyalty_pct: 40,
  target_appointment_show_pct: 70,
  target_callback_rate_pct: 85,
  alert_held_rate_gap_pp: 15,
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function PerformanceThresholdsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [values, setValues] = useState<Thresholds>(DEFAULTS);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/company/${companyId}/intelligence/config`);
        if (res.ok) {
          const data = await res.json();
          const e8 = data.configs?.find((c: { engine_key: string }) => c.engine_key === "e8");
          if (e8?.thresholds) setValues({ ...DEFAULTS, ...e8.thresholds });
        }
      } catch {
        // use defaults
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId]);

  const weightsSum = values.weight_held_rate + values.weight_chsc_conversion + values.weight_revenue_per_call + values.weight_appointments;
  const weightsValid = weightsSum === 100;

  const handleSave = async () => {
    if (!weightsValid) return;
    setStatus("saving");
    try {
      const res = await fetch(`/api/company/${companyId}/intelligence/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine_key: "e8", thresholds: values }),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 2000);
  };

  const set = (key: keyof Thresholds, v: string) => {
    setValues((prev) => ({ ...prev, [key]: Number(v) || 0 }));
  };

  if (loading) {
    return <div className="p-6 text-zinc-400">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Performance Thresholds</h1>
        <p className="text-sm text-zinc-400">Configure call center performance scoring and KPI targets for e8 engine</p>
      </div>

      {/* Section A: Badge Thresholds */}
      <Section title="Performance Badge Thresholds">
        <Field label="Excellent minimum %" value={values.badge_excellent_min} onChange={(v) => set("badge_excellent_min", v)} />
        <Field label="Good minimum %" value={values.badge_good_min} onChange={(v) => set("badge_good_min", v)} />
        <Field label="Average minimum %" value={values.badge_average_min} onChange={(v) => set("badge_average_min", v)} />
      </Section>

      {/* Section B: Held Rate Colours */}
      <Section title="Held Rate Colour Thresholds">
        <Field label="Green minimum % (Held Rate)" value={values.held_rate_green_min} onChange={(v) => set("held_rate_green_min", v)} />
        <Field label="Amber minimum % (below = red)" value={values.held_rate_amber_min} onChange={(v) => set("held_rate_amber_min", v)} />
      </Section>

      {/* Section C: Score Weights */}
      <Section title="Performance Score Weights">
        <Field label="Held Rate weight %" value={values.weight_held_rate} onChange={(v) => set("weight_held_rate", v)} />
        <Field label="CHSC Conversion weight %" value={values.weight_chsc_conversion} onChange={(v) => set("weight_chsc_conversion", v)} />
        <Field label="Revenue per Call weight %" value={values.weight_revenue_per_call} onChange={(v) => set("weight_revenue_per_call", v)} />
        <Field label="Appointments weight %" value={values.weight_appointments} onChange={(v) => set("weight_appointments", v)} />
        <div className={`text-sm font-medium ${weightsValid ? "text-emerald-400" : "text-red-400"}`}>
          Total: {weightsSum}% {!weightsValid && "(must equal 100%)"}
        </div>
      </Section>

      {/* Section D: KPI Targets */}
      <Section title="KPI Targets">
        <Field label="CHSC Loyalty Rate target %" value={values.target_chsc_loyalty_pct} onChange={(v) => set("target_chsc_loyalty_pct", v)} />
        <Field label="Appointment Show Rate target %" value={values.target_appointment_show_pct} onChange={(v) => set("target_appointment_show_pct", v)} />
        <Field label="Callback Rate target %" value={values.target_callback_rate_pct} onChange={(v) => set("target_callback_rate_pct", v)} />
        <Field label="Held Rate alert gap (pp below avg)" value={values.alert_held_rate_gap_pp} onChange={(v) => set("alert_held_rate_gap_pp", v)} />
      </Section>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!weightsValid || status === "saving"}
          className="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "saving" ? "Saving..." : "Save"}
        </button>
        {status === "saved" && <span className="text-sm text-emerald-400">Saved</span>}
        {status === "error" && <span className="text-sm text-red-400">Error saving</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <h2 className="mb-4 text-lg font-semibold text-zinc-200">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-zinc-400">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-right text-sm text-zinc-200"
      />
    </div>
  );
}
