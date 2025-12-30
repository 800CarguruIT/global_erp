import Link from "next/link";
import { AppLayout } from "@repo/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Branch = {
  id: string;
  name: string;
  code: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  is_active: boolean;
};

function safeText(value: string | null | undefined) {
  return value && value !== "null" ? value : "-";
}

type BranchListPageProps =
  | { params: { companyId: string } }
  | { params: Promise<{ companyId: string }> };

export default async function BranchListPage({ params }: BranchListPageProps) {
  const resolved = await (params as any);
  const companyId = resolved?.companyId?.toString?.().trim?.();

  if (!companyId) {
    console.error("BranchListPage: companyId param is missing");
    return (
      <AppLayout>
        <div className="p-4 text-sm text-red-400">Company is required.</div>
      </AppLayout>
    );
  }

  let branches: Branch[] = [];

  try {
    const { Branches } = await import("@repo/ai-core");
    branches = await Branches.listBranches(companyId);
  } catch (err) {
    console.error("Failed to load branches from ai-core", err);
    branches = [];
  }

  return (
    <AppLayout>
      <div className="w-full -mx-4 px-4 lg:-mx-8 lg:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold">Branches</h1>
          <Link
            href={`/company/${companyId}/branches/new`}
            className="inline-flex items-center rounded bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
          >
            Create Branch
          </Link>
        </div>

        <div className="rounded-2xl p-5 shadow-sm border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-2 py-1">Name</th>
                  <th className="px-2 py-1">Code</th>
                  <th className="px-2 py-1">Phone</th>
                  <th className="px-2 py-1">City</th>
                  <th className="px-2 py-1">Country</th>
                  <th className="px-2 py-1">Active</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {branches.length === 0 && (
                  <tr>
                    <td className="px-2 py-3 text-muted-foreground text-center" colSpan={7}>
                      No branches found.
                    </td>
                  </tr>
                )}
                {branches.map((branch) => (
                  <tr
                    key={branch.id}
                    className="border-b last:border-b-0"
                  >
                    <td className="px-2 py-1">{safeText(branch.name)}</td>
                    <td className="px-2 py-1">{safeText(branch.code)}</td>
                    <td className="px-2 py-1">{safeText(branch.phone)}</td>
                    <td className="px-2 py-1">{safeText(branch.city)}</td>
                    <td className="px-2 py-1">{safeText(branch.country)}</td>
                    <td className="px-2 py-1">
                      {branch.is_active ? "Yes" : "No"}
                    </td>
                    <td className="px-2 py-1 text-right space-x-3">
                      <Link
                        href={`/company/${companyId}/branches/${branch.id}/edit`}
                        className="text-primary hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
