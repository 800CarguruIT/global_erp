export type PurchaseOrderStatus = "draft" | "issued" | "partially_received" | "received" | "cancelled";
export type PurchaseOrderSourceType = "quote" | "manual";
export type PurchaseOrderType = "po" | "lpo";

export type PurchaseOrder = {
  id: string;
  companyId: string;
  vendorId?: string | null;
  vendorName?: string | null;
  vendorContact?: string | null;
  poNumber: string;
  poType: PurchaseOrderType;
  sourceType: PurchaseOrderSourceType;
  quoteId?: string | null;
  status: PurchaseOrderStatus;
  currency?: string | null;
  expectedDate?: string | null;
  notes?: string | null;
  totalCost: number;
  createdBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseOrderItem = {
  id: string;
  purchaseOrderId: string;
  lineNo: number;
  estimateItemId?: string | null;
  partsCatalogId?: string | null;
  name: string;
  description?: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
  receivedQty: number;
  status: "pending" | "partial" | "received" | "cancelled";
};
