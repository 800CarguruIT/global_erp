"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@repo/ui";
import { useRouter } from "next/navigation";

export default function BranchSettingsPage({
  params,
}: {
  params: { companyId: string; branchId: string } | Promise<{ companyId: string; branchId: string }>;
}) {
  const router = useRouter();
  const [ids, setIds] = useState<{ companyId: string; branchId: string } | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setIds({ companyId: p.companyId, branchId: p.branchId }));
  }, [params]);

  if (!ids) return <AppLayout><div className="py-4 text-sm text-muted-foreground">Loading...</div></AppLayout>;

  const base = `/company/${ids.companyId}/branches/${ids.branchId}/settings`;

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Branch Settings</h1>
          <p className="text-sm text-muted-foreground">Configure branch-level security, users, and roles.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { title: "Users", desc: "Manage branch user accounts", href: `${base}/security/users` },
            { title: "Roles", desc: "Define branch-level roles and permissions", href: `${base}/security/roles` },
            { title: "Monitoring", desc: "Session tracking and activity logs", href: `${base}/security/monitoring` },
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
