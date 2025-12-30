export type InspectionStatus = "draft" | "in_progress" | "completed" | "approved" | "cancelled";

export type Inspection = {
  id: string;
  companyId: string;
  leadId?: string | null;
  carId?: string | null;
  customerId?: string | null;
  inspectorEmployeeId?: string | null;
  advisorEmployeeId?: string | null;
  status: InspectionStatus;
  healthEngine?: number | null;
  healthTransmission?: number | null;
  healthBrakes?: number | null;
  healthSuspension?: number | null;
  healthElectrical?: number | null;
  overallHealth?: number | null;
  customerRemark?: string | null;
  agentRemark?: string | null;
  inspectorRemark?: string | null;
  inspectorRemarkLayman?: string | null;
  aiSummaryMarkdown?: string | null;
  aiSummaryPlain?: string | null;
  draftPayload?: any | null;
  mediaSummary?: any | null;
  createdAt: string;
  updatedAt: string;
};

export type InspectionItem = {
  id: string;
  inspectionId: string;
  lineNo: number;
  category?: string | null;
  partName: string;
  severity?: string | null;
  requiredAction?: string | null;
  techReason?: string | null;
  laymanReason?: string | null;
  photoRefs?: any | null;
  createdAt: string;
  updatedAt: string;
};
