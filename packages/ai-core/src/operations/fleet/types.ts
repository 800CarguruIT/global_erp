export type FleetStatus = "available" | "on_job" | "maintenance" | "out_of_service";
export type FleetVehicleType = "rsa" | "recovery" | "parts" | "other";

export type FleetVehicle = {
  id: string;
  companyId: string;
  branchId: string;
  code: string;
  name: string;
  vehicleType: FleetVehicleType;
  plateNumber?: string | null;
  make?: string | null;
  model?: string | null;
  modelYear?: number | null;
  capacityJobs: number;
  status: FleetStatus;
  isActive: boolean;
  inventoryLocationId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FleetBranchSummary = {
  branchId: string;
  total: number;
  available: number;
  onJob: number;
  maintenance: number;
  outOfService: number;
};
