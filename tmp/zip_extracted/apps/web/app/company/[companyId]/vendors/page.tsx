import Link from "next/link";
import { AppLayout } from "@repo/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Vendor = {
  id: string;
  code?: string | null;
  name?: string | null;
  display_name?: string | null;
  legal_name?: string | null;
  phone_code?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  country?: string | null;
  is_active?: boolean | null;
};

const safeText = (value: string | null | undefined) =>
  value?.toString().trim() || "-";

type VendorListPageProps =
  | { params: { companyId: string } }
  | { params: Promise<{ companyId: string }> };

export default async function VendorListPage({ params }: VendorListPageProps) {
  const resolved = await (params as any);
  const companyId = resolved?.companyId?.toString?.().trim?.();

  if (!companyId) {
    console.error("VendorListPage: companyId param is missing");
    return (
      <AppLayout>
        <div className="p-4 text-sm text-red-400">Company is required.</div>
      </AppLayout>
    );
  }

  let vendors: Vendor[] = [];

  try {
    const { Vendors } = await import("@repo/ai-core");
    vendors = await Vendors.listVendors(companyId);
  } catch (err) {
    console.error("Failed to load vendors from ai-core", err);
    vendors = [];
  }

  return (
    <AppLayout>
      <div className="w-full -mx-4 px-4 lg:-mx-8 lg:px-8 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Vendors</h1>
          <Link className="rounded-md border px-3 py-2 text-sm hover:bg-muted" href={`/company/${companyId}/vendors/new`}>
            Create Vendor
          </Link>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {vendors.map((vendor) => {
                const phone = vendor.phone
                  ? `${vendor.phone_code ?? ""} ${vendor.phone ?? ""}`.trim()
                  : "";
                return (
                  <tr key={vendor.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      {safeText(
                        vendor.display_name ?? vendor.legal_name ?? vendor.name
                      )}
                    </td>
                    <td className="px-4 py-3">{safeText(vendor.code)}</td>
                    <td className="px-4 py-3">{phone || "-"}</td>
                    <td className="px-4 py-3">{safeText(vendor.email)}</td>
                    <td className="px-4 py-3">{safeText(vendor.city)}</td>
                    <td className="px-4 py-3">{safeText(vendor.country)}</td>
                    <td className="px-4 py-3">
                      {vendor.is_active ?? true ? "Active" : "Inactive"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        className="text-primary hover:underline"
                        href={`/company/${companyId}/vendors/${vendor.id}/edit`}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {vendors.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No vendors found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
