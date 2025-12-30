"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout, Card } from "@repo/ui";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default function CompanySettingsHome({ params }: Params) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage company settings and integrations.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {companyId && (
            <SettingsCard
              title="Integrations"
              description="Manage company channel and dialer integrations."
              href={`/company/${companyId}/settings/integrations`}
            />
          )}
          <SettingsCard
            title="Profile"
            description="View and update your profile."
            href="/profile"
          />
        </div>
      </div>
    </AppLayout>
  );
}

function SettingsCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link href={href}>
      <Card className="h-full cursor-pointer transition hover:border-primary/60">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-lg font-semibold">{title}</div>
            <div className="text-sm text-muted-foreground">{description}</div>
          </div>
          <span className="text-xs text-primary">Open</span>
        </div>
      </Card>
    </Link>
  );
}
