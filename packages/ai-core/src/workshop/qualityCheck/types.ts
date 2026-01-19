export type QualityCheckStatus = "queue" | "in_process" | "completed" | "failed";
export type QualityCheckItemStatus = "pending" | "ok" | "issue";

export type QualityCheck = {
  id: string;
  companyId: string;
  workOrderId: string;
  estimateId?: string | null;
  inspectionId?: string | null;
  leadId?: string | null;
  carId?: string | null;
  customerId?: string | null;
  status: QualityCheckStatus;
  testDriveDone: boolean;
  washDone: boolean;
  qcRemarks?: string | null;
  qcVideoRef?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QualityCheckItem = {
  id: string;
  qualityCheckId: string;
  workOrderItemId: string;
  lineNo: number;
  qcStatus: QualityCheckItemStatus;
  qcNote?: string | null;
  createdAt: string;
  updatedAt: string;
};
