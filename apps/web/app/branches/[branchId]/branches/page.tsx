import { AppLayout } from "@repo/ui";
import { cookies, headers } from "next/headers";
import BranchListClient from "../../../(components)/branches/BranchListClient";

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

type BranchListPageProps =
  | { params: { branchId: string } }
  | { params: Promise<{ branchId: string }> };

function getCompanyIdFromCookie(value?: string | null) {
  if (!value) return null;
  const match = value.match(/^\/company\/([^/]+)\/branches\/([^/]+)/);
  return match?.[1] ?? null;
}

export default async function BranchListPage({ params }: BranchListPageProps) {
  const resolved = await (params as any);
  const branchId = resolved?.branchId?.toString?.().trim?.();

  if (!branchId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-red-400">Branch is required.</div>
      </AppLayout>
    );
  }

  const cookieStore = await cookies();
  const companyId = getCompanyIdFromCookie(cookieStore.get("last_branch_path")?.value);

  if (!companyId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-red-400">Company is required.</div>
      </AppLayout>
    );
  }

  let branches: Branch[] = [];

  try {
    const headerStore = await headers();
    const host = headerStore.get("host");
    const proto = headerStore.get("x-forwarded-proto") ?? "http";
    const cookieHeader = headerStore.get("cookie") ?? "";
    const baseUrl = host ? `${proto}://${host}` : null;
    if (!baseUrl) {
      throw new Error("Missing host header for branch fetch");
    }
    const res = await fetch(
      `${baseUrl}/api/company/${companyId}/branches?includeInactive=true&scope=branch&branchId=${branchId}`,
      {
        cache: "no-store",
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      }
    );
    if (res.ok) {
      const data = await res.json();
      branches = (data?.branches ?? data?.data ?? []) as Branch[];
    } else {
      branches = [];
    }
  } catch (err) {
    console.error("Failed to load branches", err);
    branches = [];
  }

  return (
    <AppLayout>
      <BranchListClient companyId={companyId} branches={branches} scope="branch" branchId={branchId} />
    </AppLayout>
  );
}
