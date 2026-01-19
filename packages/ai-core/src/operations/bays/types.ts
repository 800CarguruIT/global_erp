export type BayStatus = "available" | "occupied" | "maintenance" | "blocked";
export type BayType = "mechanical" | "body" | "paint" | "other";

export type WorkshopBay = {
  id: string;
  companyId: string;
  branchId: string;
  code: string;
  name: string;
  bayType: BayType;
  capacityCars: number;
  status: BayStatus;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BayBranchSummary = {
  branchId: string;
  total: number;
  available: number;
  occupied: number;
  maintenance: number;
  blocked: number;
};
