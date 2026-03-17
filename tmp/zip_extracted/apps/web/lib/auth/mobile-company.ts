import { getUserContext } from "./user-context";

export async function ensureCompanyAccess(userId: string, companyId: string) {
  if (!companyId) {
    throw new Error("companyId is required");
  }
  const context = await getUserContext(userId);
  if (context.isGlobal) {
    return;
  }
  const hasAccess = context.companies.some((company) => company.companyId === companyId);
  if (!hasAccess) {
    throw new Error("Unauthorized for company");
  }
}
