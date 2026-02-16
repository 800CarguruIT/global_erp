export type InspectionStatus = "pending" | "completed" | "cancelled";

export type Inspection = {
  id: string;
  companyId: string;
  leadId?: string | null;
  carId?: string | null;
  customerId?: string | null;
  branchId?: string | null;
  inspectorEmployeeId?: string | null;
  advisorEmployeeId?: string | null;
  status: InspectionStatus;
  startAt?: string | null;
  completeAt?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  cancelRemarks?: string | null;
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

export type LineItemStatus = "Pending" | "Approved" | "Inquiry" | "Rejected";
export type OrderStatus = "Pending" | "Ordered" | "Received" | "Returned";
export type LineItemSource = "inspection" | "estimate";

export type InspectionLineItem = {
  id: string;
  companyId: string;
  leadId?: string | null;
  inspectionId: string;
  jobCardId?: string | null;
  isAdd?: number | null;
  source?: LineItemSource | null;
  productId?: number | null;
  productName?: string | null;
  description?: string | null;
  quantity: number;
  reason?: string | null;
  status: LineItemStatus;
  mediaFileId?: string | null;
  partOrdered?: number | null;
  orderStatus?: OrderStatus | null;
  quoteCosts?: {
    oem?: number;
    oe?: number;
    aftm?: number;
    used?: number;
  };
  createdAt: string;
  updatedAt: string;
};
