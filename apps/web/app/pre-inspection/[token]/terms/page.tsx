"use client";

import { useEffect, useState } from "react";

type Params = { params: { token: string } | Promise<{ token: string }> };

export default function PreInspectionTermsPage({ params }: Params) {
  const [token, setToken] = useState("");
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [carLabel, setCarLabel] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p: any) => setToken(String(p?.token ?? "").trim()));
  }, [params]);

  useEffect(() => {
    if (!token) return;
    void fetch(`/api/public/pre-inspection/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const d = json?.data;
        setCustomerName(d?.customerName ?? null);
        setCarLabel(d?.carLabel ?? null);
      })
      .catch(() => undefined);
  }, [token]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-border bg-slate-900/70 p-5">
          <h1 className="text-2xl font-semibold">Terms and Conditions</h1>
          <p className="mt-1 text-sm text-slate-300">
            Pre-inspection / pre-pickup consent and declaration.
          </p>
          <div className="mt-3 text-sm text-slate-300">
            <div>Customer: {customerName ?? "-"}</div>
            <div>Vehicle: {carLabel ?? "-"}</div>
          </div>
        </div>

        <section className="mt-4 space-y-3 rounded-2xl border border-border bg-slate-900/70 p-5 text-sm leading-6 text-slate-200">
          <p>
            By submitting this form, I confirm the provided information is accurate to the best of my knowledge.
          </p>
          <p>
            I understand this declaration is required before inspection start (walk-in) or before pickup (recovery),
            and service processing may be blocked until completion.
          </p>
          <p>
            I authorize the company to use this information for diagnosis, service planning, and communication
            updates through SMS, email, and WhatsApp.
          </p>
          <p>
            I acknowledge that additional findings may appear during inspection and may require further approval.
          </p>
        </section>
      </div>
    </main>
  );
}

