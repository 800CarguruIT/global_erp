import { Users } from "@repo/ai-core";
import { getUserRoles } from "@repo/ai-core/auth/rbac/repository";

export async function getUserContext(userId: string): Promise<{
  isGlobal: boolean;
  scope: "global" | "company" | "branch" | "vendor";
  companies: { companyId: string | null; branchId: string | null; vendorId: string | null }[];
}> {
  try {
    const roleRows = await getUserRoles(userId);
    const priority: Array<"vendor" | "branch" | "company" | "global"> = [
      "vendor",
      "branch",
      "company",
      "global",
    ];
    let scope: "global" | "company" | "branch" | "vendor" = "global";
    let companyId: string | null = null;
    let branchId: string | null = null;
    let vendorId: string | null = null;

    for (const target of priority) {
      const match = roleRows.find((r: any) => r.scope === target);
      if (match) {
        scope = match.scope as any;
        companyId = match.company_id ?? null;
        branchId = match.branch_id ?? null;
        vendorId = match.vendor_id ?? null;
        break;
      }
    }

    // Fallback to employee linkage only if no scoped role was found.
    if (scope === "global") {
      const { employee } = await Users.getUserWithEmployee(userId);
      if (employee) {
        companyId = employee.company_id ?? companyId;
        branchId = employee.branch_id ?? branchId;
        vendorId = employee.vendor_id ?? vendorId;
        const inferredScope =
          employee.scope ??
          (vendorId ? "vendor" : branchId ? "branch" : companyId ? "company" : "global");
        scope = inferredScope as any;
      }
    }

    return {
      isGlobal: scope === "global",
      scope,
      companies: [{ companyId, branchId, vendorId }],
    };
  } catch (err) {
    console.warn("getUserContext failed", err);
    return { isGlobal: true, scope: "global", companies: [] };
  }
}
