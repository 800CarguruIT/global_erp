import { InspectionDetailPageClient } from "../../../../../inspections/[inspectionId]/page";

type Props =
  | { params: { companyId: string; branchId: string; inspectionId: string } }
  | { params: Promise<{ companyId: string; branchId: string; inspectionId: string }> };

export default async function BranchWorkshopInspectionDetailPage({ params }: Props) {
  const resolved = await Promise.resolve(params);
  return (
    <InspectionDetailPageClient
      params={{ companyId: resolved.companyId, inspectionId: resolved.inspectionId }}
      forceWorkshopView
      workshopBranchIdProp={resolved.branchId}
    />
  );
}
