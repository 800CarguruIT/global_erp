"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

type CompanyCtx = {
  isGlobal: boolean;
  companies: { companyId: string; branchId: string | null }[];
};

export default function SelectCompanyPage() {
  const [data, setData] = useState<CompanyCtx | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/auth/my-companies");
        if (!res.ok) throw new Error("Failed to load companies");
        const body = await res.json();
        setData(body);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load companies");
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-6 rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Choose your company</h1>
          <p className="text-sm text-gray-400">Select the company workspace you want to enter.</p>
        </div>
        {error && <div className="text-sm text-red-400">{error}</div>}
        {!error && !data && <div className="text-sm text-gray-400">Loading...</div>}
        {data && (
          <div className="space-y-3">
            {data.isGlobal && data.companies.length === 0 && (
              <div className="text-sm text-gray-400">You have global access. Go to Global console.</div>
            )}
            <div className="space-y-2">
              {data.companies.map((c) => (
                <Link
                  key={c.companyId}
                  href={`/company/${c.companyId}`}
                  className="block rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 hover:border-blue-500/60"
                >
                  <div className="font-semibold">Company {c.companyId}</div>
                  {c.branchId && <div className="text-xs text-gray-400">Branch: {c.branchId}</div>}
                </Link>
              ))}
              {data.companies.length === 0 && (
                <Link
                  href="/global"
                  className="block rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 hover:border-blue-500/60"
                >
                  Go to Global
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
