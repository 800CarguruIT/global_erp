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
  locationId: string | null;
  locationCode: string | null;
  locationName: string | null;
  onHand: number;
};

export type InventoryTransferStatus = "draft" | "in_transit" | "completed" | "cancelled";

export type InventoryTransfer = {
  id: string;
  companyId: string;
  transferNumber: string;
  fromLocationId: string;
  toLocationId: string;
  status: InventoryTransferStatus;
  notes?: string | null;
  createdBy?: string | null;
  completedBy?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InventoryTransferItem = {
  id: string;
  transferId: string;
  lineNo: number;
  partsCatalogId: string;
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
