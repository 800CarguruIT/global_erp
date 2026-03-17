"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@repo/ui";
import { useRouter } from "next/navigation";

export default function VendorSettingsPage({
  params,
}: {
  params: { companyId: string; vendorId: string } | Promise<{ companyId: string; vendorId: string }>;
}) {
  const router = useRouter();
  const [ids, setIds] = useState<{ companyId: string; vendorId: string } | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setIds({ companyId: p.companyId, vendorId: p.vendorId }));
  }, [params]);

  if (!ids) return <AppLayout><div className="py-4 text-sm text-muted-foreground">Loading...</div></AppLayout>;

  const base = `/company/${ids.companyId}/vendors/${ids.vendorId}/settings`;

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Vendor Settings</h1>
          <p className="text-sm text-muted-foreground">Configure vendor-level security, users, and roles.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { title: "Users", desc: "Manage vendor portal users", href: `${base}/security/users` },
            { title: "Roles", desc: "Define vendor access roles", href: `${base}/security/roles` },
            { title: "Monitoring", desc: "Vendor session tracking", href: `${base}/security/monitoring` },
          ].map((item) => (
            <button key={item.href} onClick={() => router.push(item.href)} className="text-left rounded-xl border border-border/60 bg-card/80 p-4 transition hover:border-primary/50">
              <div className="text-sm font-semibold">{item.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{item.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
