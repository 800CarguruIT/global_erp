import { redirect } from "next/navigation";

type Params = { params: Promise<{ companyId: string }> };

export default async function CompanyIntegrationsRedirect({ params }: Params) {
  const { companyId } = await params;
  redirect(`/company/${companyId}/settings/integrations`);
}
