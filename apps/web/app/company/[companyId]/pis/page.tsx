import { redirect } from "next/navigation";

export default async function PisPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  redirect(`/company/${companyId}/pis/master`);
}