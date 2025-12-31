import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  try {
    const sql = getSql();

    const [employeeRows, roleUserRows, bayRows, fleetRows, leadRows, woRows, branchMeta] = await Promise.all([
      sql/* sql */ `
        SELECT e.branch_id, COUNT(*)::int AS cnt
        FROM employees e
        WHERE e.branch_id IN (SELECT id FROM branches WHERE company_id = ${companyId})
        GROUP BY e.branch_id
      `,
      sql/* sql */ `
        SELECT r.branch_id, COUNT(DISTINCT ur.user_id)::int AS cnt
        FROM user_roles ur
        INNER JOIN roles r ON r.id = ur.role_id
        WHERE r.scope = 'branch' AND r.branch_id IN (SELECT id FROM branches WHERE company_id = ${companyId})
        GROUP BY r.branch_id
      `,
      sql/* sql */ `
        SELECT branch_id, COUNT(*)::int AS cnt
        FROM workshop_bays
        WHERE company_id = ${companyId} AND is_active = TRUE
        GROUP BY branch_id
      `,
      sql/* sql */ `
        SELECT branch_id, COUNT(*)::int AS cnt
        FROM fleet_vehicles
        WHERE company_id = ${companyId}
        GROUP BY branch_id
      `,
      sql/* sql */ `
        SELECT branch_id, lead_stage, COUNT(*)::int AS cnt
        FROM leads
        WHERE company_id = ${companyId}
        GROUP BY branch_id, lead_stage
      `,
      sql/* sql */ `
        SELECT branch_id, COUNT(*)::int AS cnt
        FROM work_orders
        WHERE company_id = ${companyId}
          AND status IN ('queue','waiting_parts','ready','in_progress','quoting')
        GROUP BY branch_id
      `,
      sql/* sql */ `
        SELECT id, branch_types, service_types
        FROM branches
        WHERE company_id = ${companyId}
      `,
    ]);

    const summary: Record<
      string,
      {
        users: number;
        bays: number;
        fleet: number;
        leads: { assigned: number; inprocess: number; completed: number };
        checkedInCars: number;
        branchTypes?: any;
        serviceTypes?: any;
      }
    > = {};

    const ensure = (id: string | null | undefined) => {
      const key = id ?? "unknown";
      if (!summary[key]) {
        summary[key] = {
          users: 0,
          bays: 0,
          fleet: 0,
          leads: { assigned: 0, inprocess: 0, completed: 0 },
          checkedInCars: 0,
        };
      }
      return key;
    };

    (employeeRows as any[]).forEach((r) => {
      const key = ensure(r.branch_id);
      summary[key].users = Number(r.cnt ?? 0);
    });
    (roleUserRows as any[]).forEach((r) => {
      const key = ensure(r.branch_id);
      summary[key].users += Number(r.cnt ?? 0);
    });
    (bayRows as any[]).forEach((r) => {
      const key = ensure(r.branch_id);
      summary[key].bays = Number(r.cnt ?? 0);
    });
    (fleetRows as any[]).forEach((r) => {
      const key = ensure(r.branch_id);
      summary[key].fleet = Number(r.cnt ?? 0);
    });
    (leadRows as any[]).forEach((r) => {
      const key = ensure(r.branch_id);
      const stage = (r.lead_stage as string) || "";
      const cnt = Number(r.cnt ?? 0);
      if (stage === "assigned" || stage === "enroute") summary[key].leads.assigned += cnt;
      else if (stage === "processing") summary[key].leads.inprocess += cnt;
      else if (stage === "completed") summary[key].leads.completed += cnt;
    });
    (woRows as any[]).forEach((r) => {
      const key = ensure(r.branch_id);
      summary[key].checkedInCars = Number(r.cnt ?? 0);
    });
    (branchMeta as any[]).forEach((r) => {
      const key = ensure(r.id);
      summary[key].branchTypes = r.branch_types ?? null;
      summary[key].serviceTypes = r.service_types ?? null;
    });

    const totals = {
      branches: Object.keys(summary).filter((k) => k !== "unknown").length,
      users: Object.values(summary).reduce((sum, v) => sum + (v?.users ?? 0), 0),
      bays: Object.values(summary).reduce((sum, v) => sum + (v?.bays ?? 0), 0),
      fleet: Object.values(summary).reduce((sum, v) => sum + (v?.fleet ?? 0), 0),
      leads: {
        assigned: Object.values(summary).reduce((sum, v) => sum + (v?.leads?.assigned ?? 0), 0),
        inprocess: Object.values(summary).reduce((sum, v) => sum + (v?.leads?.inprocess ?? 0), 0),
        completed: Object.values(summary).reduce((sum, v) => sum + (v?.leads?.completed ?? 0), 0),
      },
      checkedInCars: Object.values(summary).reduce((sum, v) => sum + (v?.checkedInCars ?? 0), 0),
    };

    return NextResponse.json({ data: summary, totals });
  } catch (err) {
    console.error("GET /api/company/[companyId]/branches/summary error", err);
    return NextResponse.json({ data: {} }, { status: 200 });
  }
}
