import { getSql } from "../../db";
import type { MarketingSegmentRow } from "./types";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

export async function listSegmentsForCompany(companyId: string): Promise<MarketingSegmentRow[]> {
  const sql = getSql();
  const res = await sql<MarketingSegmentRow[]>`
    SELECT *
    FROM marketing_segments
    WHERE company_id = ${companyId}
    ORDER BY created_at DESC
  `;
  return rowsFrom(res);
}
