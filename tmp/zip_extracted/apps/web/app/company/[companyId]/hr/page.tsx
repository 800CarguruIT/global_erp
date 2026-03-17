"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout, Card } from "@repo/ui";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default function CompanyHrPage({ params }: Params) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold">HR</h1>
          <p className="text-sm text-muted-foreground">
            Company-level HR workspace for employees and access.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <HrCard
            title="Employees"
            description="Manage the company roster, profiles, and roles."
            href={companyId ? `/company/${companyId}/hr/employees` : "#"}
            cta="Open employees"
            disabled={!companyId}
          />
          <HrCard
            title="Company Users"
            description="Invite, assign, and audit company user access."
            href={companyId ? `/company/${companyId}/settings/security/users` : "#"}
            cta="Manage users"
            disabled={!companyId}
          />
          <HrCard
            title="Branch Users"
            description="Review and manage users scoped to each branch."
            href={companyId ? `/company/${companyId}/hr/branch-users` : "#"}
            cta="Manage branch users"
            disabled={!companyId}
          />
          <HrCard
            title="Vendor Users"
            description="Invite and control access for vendor-linked accounts."
            href={companyId ? `/company/${companyId}/hr/vendor-users` : "#"}
            cta="Manage vendor users"
            disabled={!companyId}
          />
        </div>
      </div>
    </AppLayout>
  );
}

function HrCard({
  title,
  description,
  href,
  cta,
  disabled,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
  disabled?: boolean;
}) {
  const isDisabled = disabled || href === "#";
  return (
    <Card className="h-full space-y-2 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground">{description}</div>
      <Link
        href={href}
        aria-disabled={isDisabled}
        className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
          isDisabled ? "cursor-not-allowed opacity-50" : "hover:border-primary"
        }`}
      >
        {isDisabled ? "Loading..." : cta}
      </Link>
    </Card>
  );
}
