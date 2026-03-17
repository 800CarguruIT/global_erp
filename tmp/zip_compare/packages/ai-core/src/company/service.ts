import type { CompanyContactInput, CompanyContactRow, CompanyRow } from "./types";
import {
  createCompany as createCompanyRepo,
  disableCompany as disableCompanyRepo,
  getCompanyById,
  listCompanyContacts,
  replaceCompanyContacts,
  updateCompany,
} from "./repository";
import { ensureCompanyAdminForCompany } from "./companyBootstrap";

export async function updateCompanyProfile(params: {
  companyId: string;
  data: Partial<CompanyRow>;
  contacts?: CompanyContactInput[];
}): Promise<CompanyRow> {
  const row = await updateCompany(params.companyId, params.data);
  if (params.contacts) {
    const limited = params.contacts.slice(0, 3).map((c, idx) => ({ ...c, sort_order: c.sort_order ?? idx }));
    await replaceCompanyContacts(params.companyId, limited);
  }
  return row;
}

export { getCompanyById, listCompanyContacts };
export { listCompanies } from "./repository";

export async function createCompany(input: any, contacts?: CompanyContactInput[]): Promise<CompanyRow> {
  const company = await createCompanyRepo(input);
  if (contacts && contacts.length) {
    const limited = contacts.slice(0, 3).map((c, idx) => ({ ...c, sort_order: c.sort_order ?? idx }));
    await replaceCompanyContacts(company.id, limited);
  }
  await ensureCompanyAdminForCompany(company);
  return company;
}

export async function disableCompany(companyId: string): Promise<void> {
  await disableCompanyRepo(companyId);
}
