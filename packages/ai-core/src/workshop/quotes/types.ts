export type QuoteType = "vendor_part" | "branch_labor";
export type QuoteStatus =
  | "open"
  | "quoted"
  | "approved"
  | "accepted"
  | "completed"
  | "verified"
  | "draft"
  | "submitted"
  | "rejected"
  | "cancelled";

export type Quote = {
  id: string;
  companyId: string;
  quoteType: QuoteType;
  status: QuoteStatus;
  estimateId?: string | null;
  workOrderId?: string | null;
  vendorId?: string | null;
  branchId?: string | null;
  currency?: string | null;
  totalAmount: number;
  validUntil?: string | null;
  createdBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  meta?: any | null;
  createdAt: string;
  updatedAt: string;
};

export type QuoteItem = {
  id: string;
  quoteId: string;
  lineNo: number;
  estimateItemId?: string | null;
  workOrderItemId?: string | null;
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  partNumber?: string | null;
  brand?: string | null;
  partType?: string | null;
  etaDays?: number | null;
  laborHours?: number | null;
  laborRate?: number | null;
  createdAt: string;
  updatedAt: string;
};
