"use client";

import { AppLayout } from "@repo/ui";
import Link from "next/link";

type Props = { params: { companyId: string; vendorId: string } };

const cards = [
  {
    title: "Dashboard",
    desc: "Overview of your vendor activity.",
    href: "",
  },
  {
    title: "Quotes",
    desc: "Open, Quoted, Approved, Accepted, Completed, Verified.",
    href: "/quotes",
  },
  {
    title: "Procurement",
    desc: "POs from accepted quotes, delivery to invoice.",
    href: "/procurement",
  },
  {
    title: "Accounts",
    desc: "Payables/receivables and statements with this company.",
    href: "/accounts",
  },
];

export default function VendorDashboardPage({ params }: Props) {
  const { companyId, vendorId } = params;

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Vendor Dashboard</h1>
          <p className="text-sm text-muted-foreground">Company and vendor workspace.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => {
            const href = card.href ? `/company/${companyId}/vendors/${vendorId}${card.href}` : null;
            return (
              <Link key={card.title} href={href ?? "#"} className="group">
                <div className="h-full space-y-2 rounded-xl border bg-card/70 p-4 transition hover:border-primary/60 hover:shadow">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">{card.title}</h2>
                    {href ? (
                      <span className="text-xs text-primary opacity-80 group-hover:opacity-100">Open</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Coming soon</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{card.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
