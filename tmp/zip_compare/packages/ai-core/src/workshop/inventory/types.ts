export type InventoryLocationType = "branch" | "warehouse" | "fleet_vehicle" | "other";

export type InventoryLocation = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  locationType: InventoryLocationType;
  branchId?: string | null;
  fleetVehicleId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryStockRow = {
  partsCatalogId: string;
  partCode: string;
  partName: string;
  partType?: string | null;
  category?: string | null;
  subcategory?: string | null;
  categoryCode?: string | null;
  subcategoryCode?: string | null;
  locationId: string | null;
  locationCode: string | null;
  locationName: string | null;
  onHand: number;
};

export type InventoryType = {
  id: string;
  companyId: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryCategory = {
  id: string;
  companyId: string;
  inventoryTypeId: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventorySubcategory = {
  id: string;
  companyId: string;
  categoryId: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryCarMake = {
  id: string;
  companyId?: string | null;
  subcategoryId?: string | null;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryCarModel = {
  id: string;
  companyId?: string | null;
  makeId: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryModelYear = {
  id: string;
  companyId?: string | null;
  modelId: string;
  year: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryPart = {
  id: string;
  companyId: string;
  yearId: string;
  name: string;
  partType?: string | null;
  partNumber: string;
  partCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryTransferStatus = "draft" | "approved" | "in_transit" | "completed" | "cancelled";

export type InventoryTransfer = {
  id: string;
  companyId: string;
  transferNumber: string;
  fromLocationId: string;
  toLocationId: string;
  status: InventoryTransferStatus;
  notes?: string | null;
  createdBy?: string | null;
  approvedBy?: string | null;
  completedBy?: string | null;
  createdByName?: string | null;
  approvedByName?: string | null;
  dispatchedByName?: string | null;
  completedByName?: string | null;
  approvedAt?: string | null;
  dispatchedAt?: string | null;
  dispatchedBy?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InventoryTransferItem = {
  id: string;
  transferId: string;
  lineNo: number;
  partsCatalogId: string;
  partCode?: string | null;
  partName?: string | null;
  quantity: number;
};

export type InventoryReceiptLabel = {
  grnNumber: string;
  qrCode: string;
  partCode: string;
  partName?: string | null;
  locationCode: string;
  quantity: number;
};
