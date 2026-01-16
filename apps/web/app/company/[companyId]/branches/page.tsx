import { AppLayout } from "@repo/ui";
import { headers } from "next/headers";
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
    const headerStore = await headers();
    const host = headerStore.get("host");
    const proto = headerStore.get("x-forwarded-proto") ?? "http";
    const cookieHeader = headerStore.get("cookie") ?? "";
    const baseUrl = host ? `${proto}://${host}` : null;
    if (!baseUrl) {
      throw new Error("Missing host header for branch fetch");
    }
    const res = await fetch(`${baseUrl}/api/company/${companyId}/branches?includeInactive=true`, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    if (res.status === 401 || res.status === 403) {
      branches = [];
    } else if (res.ok) {
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
      <BranchListClient companyId={companyId} branches={branches} scope="company" />
    </AppLayout>
  );
}
