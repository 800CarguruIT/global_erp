export type ProcurementStatus = "pending" | "quoting" | "ordered" | "received" | "issued" | "closed";

export type PartCatalogItem = {
  id: string;
  companyId: string;
  partNumber: string;
  brand: string;
  sku: string;
  description?: string | null;
  qrCode?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PartsRequirementRow = {
  estimateItemId: string;
  estimateId: string;
  inspectionId?: string | null;
  leadId?: string | null;
  carId?: string | null;
  partName: string;
  partNumber?: string | null;
  partBrand?: string | null;
  partSku?: string | null;
  type: string;
  quantity: number;
  orderedQty: number;
  receivedQty: number;
  issuedQty: number;
  procurementStatus: ProcurementStatus;
};
