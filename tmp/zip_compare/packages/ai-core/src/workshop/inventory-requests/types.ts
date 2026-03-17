export type InventoryOrderRequestStatus = "draft" | "pending" | "approved" | "rejected" | "cancelled";
export type InventoryOrderRequestType = "inventory" | "job";

export type InventoryOrderRequest = {
  id: string;
  companyId: string;
  requestNumber: string;
  requestType: InventoryOrderRequestType;
  status: InventoryOrderRequestStatus;
  estimateId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InventoryOrderRequestItem = {
  id: string;
  requestId: string;
  lineNo: number;
  estimateItemId?: string | null;
  inventoryTypeId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  makeId?: string | null;
  modelId?: string | null;
  yearId?: string | null;
  partName: string;
  partNumber?: string | null;
  partBrand?: string | null;
  partType?: string | null;
  description?: string | null;
  unit?: string | null;
  category?: string | null;
  subcategory?: string | null;
  quantity: number;
  orderedQty: number;
  receivedQty: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};
