import { getMasterDashboardData } from "./repository";
import type { MasterDashboardFilter, MasterDashboardData } from "./types";

export async function getDashboardData(
  filter: MasterDashboardFilter
): Promise<MasterDashboardData> {
  return getMasterDashboardData(filter);
}
