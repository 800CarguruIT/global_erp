export type EstimateStatus = "draft" | "pending_approval" | "approved" | "rejected" | "cancelled" | "invoiced";
export type EstimateItemStatus = "pending" | "inquiry" | "approved" | "rejected";
export type EstimateItemCostType = "oe" | "oem" | "aftm" | "used";
export type EstimateItemQuoteCosts = Partial<Record<EstimateItemCostType, number>>;

export type Estimate = {
  id: string;
  companyId: string;
  inspectionId: string;
  leadId?: string | null;
  carId?: string | null;
  customerId?: string | null;
  status: EstimateStatus;
  currency?: string | null;
  vatRate: number;
  totalCost: number;
  totalSale: number;
  totalDiscount: number;
  finalPrice: number;
  vatAmount: number;
  grandTotal: number;
  meta?: any | null;
  createdAt: string;
  updatedAt: string;
};

export type EstimateItem = {
  id: string;
  estimateId: string;
  inspectionItemId?: string | null;
  lineNo: number;
  partName: string;
  description?: string | null;
  type: "genuine" | "oem" | "aftermarket" | "used" | "repair";
  quantity: number;
  cost: number;
  sale: number;
  gpPercent?: number | null;
  approvedCost?: number | null;
  status: EstimateItemStatus;
  createdAt: string;
  updatedAt: string;
  approvedType?: EstimateItemCostType | null;
  quoteCosts?: EstimateItemQuoteCosts;
};
