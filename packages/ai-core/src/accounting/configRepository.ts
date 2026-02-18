import { getSql } from "../db";
import type { CompanyAccountingSettings } from "./configTypes";

const FALLBACK_SELECT_WITHOUT_INVENTORY = `
  SELECT
    company_id as "companyId",
    ar_control_account_id as "arControlAccountId",
    ap_control_account_id as "apControlAccountId",
    sales_revenue_account_id as "salesRevenueAccountId",
    workshop_revenue_account_id as "workshopRevenueAccountId",
    rsa_revenue_account_id as "rsaRevenueAccountId",
    recovery_revenue_account_id as "recoveryRevenueAccountId",
    cogs_account_id as "cogsAccountId",
    labor_cost_account_id as "laborCostAccountId",
    NULL::uuid as "inventoryAccountId",
    wip_account_id as "wipAccountId",
    vat_output_account_id as "vatOutputAccountId",
    vat_input_account_id as "vatInputAccountId",
    discount_given_account_id as "discountGivenAccountId",
    discount_received_account_id as "discountReceivedAccountId",
    rounding_diff_account_id as "roundingDiffAccountId",
    cash_account_id as "cashAccountId",
    bank_clearing_account_id as "bankClearingAccountId",
    created_at as "createdAt",
    updated_at as "updatedAt"
  FROM accounting_company_settings
  WHERE company_id = $1
`;

export async function getCompanySettings(companyId: string): Promise<CompanyAccountingSettings | null> {
  const sql = getSql();
  try {
    const rows = await sql<CompanyAccountingSettings[]>`
      SELECT
        company_id as "companyId",
        ar_control_account_id as "arControlAccountId",
        ap_control_account_id as "apControlAccountId",
        sales_revenue_account_id as "salesRevenueAccountId",
        workshop_revenue_account_id as "workshopRevenueAccountId",
        rsa_revenue_account_id as "rsaRevenueAccountId",
        recovery_revenue_account_id as "recoveryRevenueAccountId",
        cogs_account_id as "cogsAccountId",
        labor_cost_account_id as "laborCostAccountId",
        inventory_account_id as "inventoryAccountId",
        wip_account_id as "wipAccountId",
        vat_output_account_id as "vatOutputAccountId",
        vat_input_account_id as "vatInputAccountId",
        discount_given_account_id as "discountGivenAccountId",
        discount_received_account_id as "discountReceivedAccountId",
        rounding_diff_account_id as "roundingDiffAccountId",
        cash_account_id as "cashAccountId",
        bank_clearing_account_id as "bankClearingAccountId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM accounting_company_settings
      WHERE company_id = ${companyId}
    `;
    return rows[0] ?? null;
  } catch (err: any) {
    if (String(err?.code) !== "42703") throw err;
    const rows = await sql.unsafe(FALLBACK_SELECT_WITHOUT_INVENTORY, [companyId]);
    return (rows?.[0] as CompanyAccountingSettings | undefined) ?? null;
  }
}

export async function upsertCompanySettings(
  companyId: string,
  input: Partial<CompanyAccountingSettings>
): Promise<CompanyAccountingSettings> {
  const sql = getSql();

  let row: CompanyAccountingSettings[];
  try {
    row = await sql<CompanyAccountingSettings[]>`
      INSERT INTO accounting_company_settings (
        company_id,
        ar_control_account_id,
        ap_control_account_id,
        sales_revenue_account_id,
        workshop_revenue_account_id,
        rsa_revenue_account_id,
        recovery_revenue_account_id,
        cogs_account_id,
        labor_cost_account_id,
        inventory_account_id,
        wip_account_id,
        vat_output_account_id,
        vat_input_account_id,
        discount_given_account_id,
        discount_received_account_id,
        rounding_diff_account_id,
        cash_account_id,
        bank_clearing_account_id
      )
      VALUES (
        ${companyId},
        ${input.arControlAccountId ?? null},
        ${input.apControlAccountId ?? null},
        ${input.salesRevenueAccountId ?? null},
        ${input.workshopRevenueAccountId ?? null},
        ${input.rsaRevenueAccountId ?? null},
        ${input.recoveryRevenueAccountId ?? null},
        ${input.cogsAccountId ?? null},
        ${input.laborCostAccountId ?? null},
        ${input.inventoryAccountId ?? null},
        ${input.wipAccountId ?? null},
        ${input.vatOutputAccountId ?? null},
        ${input.vatInputAccountId ?? null},
        ${input.discountGivenAccountId ?? null},
        ${input.discountReceivedAccountId ?? null},
        ${input.roundingDiffAccountId ?? null},
        ${input.cashAccountId ?? null},
        ${input.bankClearingAccountId ?? null}
      )
      ON CONFLICT (company_id) DO UPDATE SET
        ar_control_account_id = EXCLUDED.ar_control_account_id,
        ap_control_account_id = EXCLUDED.ap_control_account_id,
        sales_revenue_account_id = EXCLUDED.sales_revenue_account_id,
        workshop_revenue_account_id = EXCLUDED.workshop_revenue_account_id,
        rsa_revenue_account_id = EXCLUDED.rsa_revenue_account_id,
        recovery_revenue_account_id = EXCLUDED.recovery_revenue_account_id,
        cogs_account_id = EXCLUDED.cogs_account_id,
        labor_cost_account_id = EXCLUDED.labor_cost_account_id,
        inventory_account_id = EXCLUDED.inventory_account_id,
        wip_account_id = EXCLUDED.wip_account_id,
        vat_output_account_id = EXCLUDED.vat_output_account_id,
        vat_input_account_id = EXCLUDED.vat_input_account_id,
        discount_given_account_id = EXCLUDED.discount_given_account_id,
        discount_received_account_id = EXCLUDED.discount_received_account_id,
        rounding_diff_account_id = EXCLUDED.rounding_diff_account_id,
        cash_account_id = EXCLUDED.cash_account_id,
        bank_clearing_account_id = EXCLUDED.bank_clearing_account_id
      RETURNING
        company_id as "companyId",
        ar_control_account_id as "arControlAccountId",
        ap_control_account_id as "apControlAccountId",
        sales_revenue_account_id as "salesRevenueAccountId",
        workshop_revenue_account_id as "workshopRevenueAccountId",
        rsa_revenue_account_id as "rsaRevenueAccountId",
        recovery_revenue_account_id as "recoveryRevenueAccountId",
        cogs_account_id as "cogsAccountId",
        labor_cost_account_id as "laborCostAccountId",
        inventory_account_id as "inventoryAccountId",
        wip_account_id as "wipAccountId",
        vat_output_account_id as "vatOutputAccountId",
        vat_input_account_id as "vatInputAccountId",
        discount_given_account_id as "discountGivenAccountId",
        discount_received_account_id as "discountReceivedAccountId",
        rounding_diff_account_id as "roundingDiffAccountId",
        cash_account_id as "cashAccountId",
        bank_clearing_account_id as "bankClearingAccountId",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;
  } catch (err: any) {
    if (String(err?.code) !== "42703") throw err;
    row = await sql<CompanyAccountingSettings[]>`
      INSERT INTO accounting_company_settings (
        company_id,
        ar_control_account_id,
        ap_control_account_id,
        sales_revenue_account_id,
        workshop_revenue_account_id,
        rsa_revenue_account_id,
        recovery_revenue_account_id,
        cogs_account_id,
        labor_cost_account_id,
        wip_account_id,
        vat_output_account_id,
        vat_input_account_id,
        discount_given_account_id,
        discount_received_account_id,
        rounding_diff_account_id,
        cash_account_id,
        bank_clearing_account_id
      )
      VALUES (
        ${companyId},
        ${input.arControlAccountId ?? null},
        ${input.apControlAccountId ?? null},
        ${input.salesRevenueAccountId ?? null},
        ${input.workshopRevenueAccountId ?? null},
        ${input.rsaRevenueAccountId ?? null},
        ${input.recoveryRevenueAccountId ?? null},
        ${input.cogsAccountId ?? null},
        ${input.laborCostAccountId ?? null},
        ${input.wipAccountId ?? null},
        ${input.vatOutputAccountId ?? null},
        ${input.vatInputAccountId ?? null},
        ${input.discountGivenAccountId ?? null},
        ${input.discountReceivedAccountId ?? null},
        ${input.roundingDiffAccountId ?? null},
        ${input.cashAccountId ?? null},
        ${input.bankClearingAccountId ?? null}
      )
      ON CONFLICT (company_id) DO UPDATE SET
        ar_control_account_id = EXCLUDED.ar_control_account_id,
        ap_control_account_id = EXCLUDED.ap_control_account_id,
        sales_revenue_account_id = EXCLUDED.sales_revenue_account_id,
        workshop_revenue_account_id = EXCLUDED.workshop_revenue_account_id,
        rsa_revenue_account_id = EXCLUDED.rsa_revenue_account_id,
        recovery_revenue_account_id = EXCLUDED.recovery_revenue_account_id,
        cogs_account_id = EXCLUDED.cogs_account_id,
        labor_cost_account_id = EXCLUDED.labor_cost_account_id,
        wip_account_id = EXCLUDED.wip_account_id,
        vat_output_account_id = EXCLUDED.vat_output_account_id,
        vat_input_account_id = EXCLUDED.vat_input_account_id,
        discount_given_account_id = EXCLUDED.discount_given_account_id,
        discount_received_account_id = EXCLUDED.discount_received_account_id,
        rounding_diff_account_id = EXCLUDED.rounding_diff_account_id,
        cash_account_id = EXCLUDED.cash_account_id,
        bank_clearing_account_id = EXCLUDED.bank_clearing_account_id
      RETURNING
        company_id as "companyId",
        ar_control_account_id as "arControlAccountId",
        ap_control_account_id as "apControlAccountId",
        sales_revenue_account_id as "salesRevenueAccountId",
        workshop_revenue_account_id as "workshopRevenueAccountId",
        rsa_revenue_account_id as "rsaRevenueAccountId",
        recovery_revenue_account_id as "recoveryRevenueAccountId",
        cogs_account_id as "cogsAccountId",
        labor_cost_account_id as "laborCostAccountId",
        NULL::uuid as "inventoryAccountId",
        wip_account_id as "wipAccountId",
        vat_output_account_id as "vatOutputAccountId",
        vat_input_account_id as "vatInputAccountId",
        discount_given_account_id as "discountGivenAccountId",
        discount_received_account_id as "discountReceivedAccountId",
        rounding_diff_account_id as "roundingDiffAccountId",
        cash_account_id as "cashAccountId",
        bank_clearing_account_id as "bankClearingAccountId",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;
  }

  const saved = row[0];
  if (!saved) {
    throw new Error("Failed to save accounting settings");
  }
  return saved;
}
