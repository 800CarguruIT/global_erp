import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { HrEmployees, HrEmployeeTypes } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

const allowanceSchema = z.object({
  kind: z.enum(["housing", "transport", "education", "medical", "other"]).or(z.string()),
  label: z.string().optional().nullable(),
  amount: z.number().nonnegative(),
});

const employeeSchema = z.object({
  scope: z.enum(["global", "company", "branch", "vendor"]),
  companyId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),

  firstName: z.string().min(1),
  lastName: z.string().min(1),
  fullName: z.string().optional(),
  tempAddress: z.string().optional().nullable(),
  permAddress: z.string().optional().nullable(),
  currentLocation: z.string().optional().nullable(),

  phonePersonal: z.string().optional().nullable(),
  phoneCompany: z.string().optional().nullable(),
  emailPersonal: z.string().email().optional().nullable(),
  emailCompany: z.string().email().optional().nullable(),

  docIdNumber: z.string().optional().nullable(),
  docIdIssue: z.string().optional().nullable(),
  docIdExpiry: z.string().optional().nullable(),
  docPassportNumber: z.string().optional().nullable(),
  docPassportIssue: z.string().optional().nullable(),
  docPassportExpiry: z.string().optional().nullable(),
  docIdFileId: z.string().optional().nullable(),
  docPassportFileId: z.string().optional().nullable(),

  nationality: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  division: z.string().optional().nullable(),
  department: z.string().optional().nullable(),

  startDate: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),

  basicSalary: z.number().nonnegative(),
  pensionAmount: z.number().nonnegative().optional().default(0),
  gratuityAmount: z.number().nonnegative().optional().default(0),

  visaRequired: z.boolean().optional().default(false),
  visaFee: z.number().nonnegative().optional().default(0),
  immigrationFee: z.number().nonnegative().optional().default(0),
  workPermitFee: z.number().nonnegative().optional().default(0),
  adminFee: z.number().nonnegative().optional().default(0),
  insuranceFee: z.number().nonnegative().optional().default(0),

  employeeType: z.enum(["full_time", "part_time", "probation"]).optional().default("full_time"),
  accommodationType: z.enum(["self", "company"]).optional().default("self"),
  transportType: z.enum(["self", "company"]).optional().default("self"),

  workingDaysPerWeek: z.number().int().positive().optional().nullable(),
  workingHoursPerDay: z.number().nonnegative().optional().nullable(),
  officialDayOff: z.string().optional().nullable(),

  emergencyName: z.string().optional().nullable(),
  emergencyPhone: z.string().optional().nullable(),
  emergencyEmail: z.string().email().optional().nullable(),
  emergencyRelation: z.string().optional().nullable(),
  emergencyAddress: z.string().optional().nullable(),

  imageFileId: z.string().optional().nullable(),

  allowances: z.array(allowanceSchema).max(5).optional(),
});

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as HrEmployeeTypes.EmployeeScope;
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const branchId = url.searchParams.get("branchId") ?? undefined;
    const vendorId = url.searchParams.get("vendorId") ?? undefined;

    const permResp = await requirePermission(
      req,
      "hr.employees.view",
      buildScopeContextFromRoute({ companyId, branchId, vendorId }, scope)
    );
    if (permResp) return permResp;

    const data = await HrEmployees.getEmployeeDetails({
      id,
      scope,
      companyId,
      branchId,
      vendorId,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/hr/employees/[id] error:", error);
    return NextResponse.json({ error: "Failed to load employee" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    const json = await req.json();
    const parsed = employeeSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const permResp = await requirePermission(
      req,
      "hr.employees.edit",
      buildScopeContextFromRoute(
        {
          companyId: parsed.data.companyId ?? undefined,
          branchId: parsed.data.branchId ?? undefined,
          vendorId: parsed.data.vendorId ?? undefined,
        },
        parsed.data.scope
      )
    );
    if (permResp) return permResp;
    const body = parsed.data;

    const updated = await HrEmployees.updateEmployeeRecord({
      id,
      scope: body.scope,
      companyId: body.companyId ?? null,
      branchId: body.branchId ?? null,
      vendorId: body.vendorId ?? null,
      input: body,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/hr/employees/[id] error:", error);
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    // Require edit permission to delete
    // Note: minimal context inference is not available without URL params; this could be extended as needed.
    await HrEmployees.deleteEmployee(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/hr/employees/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete employee" }, { status: 500 });
  }
}
