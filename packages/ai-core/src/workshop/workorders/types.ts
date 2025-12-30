export type WorkOrderStatus =
  | "draft"
  | "quoting"
  | "queue"
  | "waiting_parts"
  | "ready"
  | "in_progress"
  | "completed"
  | "closed";

export type WorkLineStatus =
  | "pending"
  | "waiting_parts"
  | "ready"
  | "in_progress"
  | "completed";

export type WorkOrder = {
  id: string;
  companyId: string;
  estimateId: string;
  inspectionId?: string | null;
  leadId?: string | null;
  carId?: string | null;
  customerId?: string | null;
  branchId?: string | null;
  status: WorkOrderStatus;
  queueReason?: string | null;
  workStartedAt?: string | null;
  workCompletedAt?: string | null;
  meta?: any | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkOrderItem = {
  id: string;
  workOrderId: string;
  estimateItemId: string;
  lineNo: number;
  partName: string;
  description?: string | null;
  isPart: boolean;
  isLabor: boolean;
  requiredQty: number;
  issuedQty: number;
  workStatus: WorkLineStatus;
  createdAt: string;
  updatedAt: string;
};
