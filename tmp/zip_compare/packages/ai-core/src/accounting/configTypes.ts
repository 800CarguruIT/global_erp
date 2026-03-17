export type CompanyAccountingSettings = {
  companyId: string;

  arControlAccountId?: string | null;
  apControlAccountId?: string | null;

  salesRevenueAccountId?: string | null;
  workshopRevenueAccountId?: string | null;
  rsaRevenueAccountId?: string | null;
  recoveryRevenueAccountId?: string | null;

  cogsAccountId?: string | null;
  laborCostAccountId?: string | null;
  inventoryAccountId?: string | null;
  wipAccountId?: string | null;

  vatOutputAccountId?: string | null;
  vatInputAccountId?: string | null;

  discountGivenAccountId?: string | null;
  discountReceivedAccountId?: string | null;
  roundingDiffAccountId?: string | null;

  cashAccountId?: string | null;
  bankClearingAccountId?: string | null;

  createdAt?: string;
  updatedAt?: string;
};
