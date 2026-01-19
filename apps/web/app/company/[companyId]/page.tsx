import { AppLayout, ModulePlaceholder } from "@repo/ui";
import { redirect } from "next/navigation";

type Props = { params: { companyId: string } | Promise<{ companyId: string }> };

export default async function CompanyHomePage({ params }: Props) {
  const resolved = await (params as any);
  const companyId = resolved?.companyId?.toString?.();

  if (!companyId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Company ID is required.</div>
      </AppLayout>
    );
  }

  try {
    // Relative fetch in a server component keeps the user cookies.
    const res = await fetch("/api/auth/my-companies", { cache: "no-store" });
    if (res.ok) {
      const ctx = await res.json();
      const entry = (ctx?.companies ?? []).find((c: any) => c.companyId === companyId);
      if (entry?.branchId) {
        return redirect(`/company/${companyId}/branches/${entry.branchId}`);
      }
    }

    // If user has no branch assignment but the company only has a single branch, route there.
    const branchesRes = await fetch(`/api/company/${companyId}/branches`, { cache: "no-store" });
    if (branchesRes.ok) {
      const data = await branchesRes.json();
      const branches: any[] = data?.branches ?? data ?? [];
      const first = branches[0];
      if (first?.id) {
        return redirect(`/company/${companyId}/branches/${first.id}`);
      }
    }
  } catch {
    // ignore and fall through to company dashboard
  }

  return (
    <AppLayout>
      <ModulePlaceholder title="Company Overview" description="Main dashboard for this company will be added here." />
    </AppLayout>
  );
}
