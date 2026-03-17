export type InvoiceStatus = "draft" | "issued" | "paid" | "cancelled";

export type Invoice = {
  id: string;
  companyId: string;
  workOrderId: string;
  estimateId?: string | null;
  qualityCheckId?: string | null;
  inspectionId?: string | null;
  leadId?: string | null;
  carId?: string | null;
  customerId?: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  status: InvoiceStatus;
  paymentMethod?: string | null;
  dueDate?: string | null;
  paidAt?: string | null;
  totalSale: number;
  totalDiscount: number;
  finalAmount: number;
  vatRate: number;
  vatAmount: number;
  grandTotal: number;
  terms?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceItem = {
  id: string;
  invoiceId: string;
  workOrderItemId?: string | null;
  estimateItemId?: string | null;
  lineNo: number;
  name: string;
  description?: string | null;
  quantity: number;
  rate: number;
  lineSale: number;
  lineDiscount: number;
  lineFinal: number;
};
