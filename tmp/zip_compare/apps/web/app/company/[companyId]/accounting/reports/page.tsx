import Link from "next/link";
import { AppLayout, Card } from "@repo/ui";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

const links = [
  { title: "Profit & Loss", subtitle: "Review income and expenses.", slug: "pnl" },
  { title: "Cash Flow", subtitle: "Track operating, investing, and financing cash.", slug: "cashflow" },
  { title: "Trial Balance", subtitle: "Check balances across accounts.", slug: "trial-balance" },
  { title: "Balance Sheet", subtitle: "Review assets, liabilities, and equity.", slug: "balance-sheet" },
];

export default async function CompanyAccountingReportsPage({ params }: Params) {
  const resolved = params instanceof Promise ? await params : params;
  const { companyId } = resolved;

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold">Accounting Reports</h1>
          <p className="text-sm text-muted-foreground">Company-level accounting reports.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {links.map((item) => (
            <Link key={item.slug} href={`/company/${companyId}/accounting/reports/${item.slug}`}>
              <Card className="h-full cursor-pointer transition hover:border-primary/60">
                <div className="text-sm text-muted-foreground">Reports</div>
                <div className="mt-1 text-lg font-semibold">{item.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.subtitle}</div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
