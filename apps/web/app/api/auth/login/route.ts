import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSql } from "@repo/ai-core";
import { createSessionToken, setSessionCookie } from "../../../../lib/auth/session";
import { getUserContext } from "../../../../lib/auth/user-context";
import type { Branch } from "@repo/ai-core";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  company_id?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = body?.email?.toString().trim().toLowerCase();
    const password = body?.password?.toString();
    if (!email || !password) {
      return NextResponse.json({ error: "email and password are required" }, { status: 400 });
    }

    const sql = getSql();
    const res = await sql<UserRow[]>`
      SELECT id, email, password_hash, is_active, company_id
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `;
    const user = (res as any).rows ? (res as any).rows[0] : res[0];
    if (!user || user.is_active === false) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = createSessionToken(user.id);
    const ctx = await getUserContext(user.id);

    const lastBranchPath = req.cookies.get("last_branch_path")?.value;
    const companies = ctx?.companies ?? [];
    const primary = companies[0];
    const companyId = user.company_id ?? primary?.companyId;
    let branchId = primary?.branchId ?? null;
    const vendorId = primary?.vendorId ?? null;
    const scope = ctx?.scope ?? (ctx?.isGlobal ? "global" : "company");

    // If no branch from context but company exists, try to pick the first active branch for that company.
    if (companyId && !branchId && scope === "branch") {
      try {
        const { Branches } = await import("@repo/ai-core");
        const branches = await Branches.listBranches(companyId, { activeOnly: true });
        if (Array.isArray(branches) && branches.length === 1) {
          branchId = branches[0]?.id ?? null;
        }
      } catch (_err) {
        // ignore; fallback to company/home
      }
    }

    let branchRecord: Branch | null = null;
    if (companyId && branchId) {
      try {
        const { Branches } = await import("@repo/ai-core");
        branchRecord = await Branches.getBranchById(companyId, branchId);
        if (!branchRecord || branchRecord.is_active === false) {
          return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }
      } catch (err) {
        console.error("Branch lookup failed during login", err);
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }
    }

    const baseBranchPath =
      companyId && branchId ? `/company/${companyId}/branches/${branchId}` : null;
    const thirdPartyWorkshopPath =
      branchRecord?.ownership_type === "third_party" && baseBranchPath
        ? `${baseBranchPath}/workshop`
        : null;
    const branchRedirectPath = thirdPartyWorkshopPath ?? (branchId ? `/branches/${branchId}` : "/company");

    // Compute redirect based on scope
    // TODO: add explicit "workshop" scope + workshopId routing when implemented.
    let redirect = "/global";
    if (ctx?.isGlobal || scope === "global") {
      redirect = "/global";
    } else if (scope === "vendor") {
      redirect =
        companyId && vendorId
          ? `/company/${companyId}/vendors/${vendorId}`
          : vendorId
          ? `/company/${companyId ?? "unknown"}/vendors/${vendorId}`
          : "/global";
    } else if (scope === "branch") {
      redirect = branchRedirectPath;
    } else if (scope === "company" && companyId) {
      redirect = `/company/${companyId}`;
    } else if (vendorId && companyId) {
      redirect = `/company/${companyId}/vendors/${vendorId}`;
    } else if (branchId && companyId) {
      redirect = branchRedirectPath;
    } else if (!ctx?.isGlobal && companies.length === 1 && companies[0]?.companyId) {
      redirect = `/company/${companies[0].companyId}`;
    } else if (!ctx?.isGlobal && companies.length > 1) {
      redirect = "/auth/select-company";
    }

    const response = NextResponse.json({ success: true, redirect });
    setSessionCookie(response, token);
    const branchPath = thirdPartyWorkshopPath ?? baseBranchPath;
    if (branchPath) {
      response.cookies.set("last_branch_path", branchPath, {
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    } else {
      // Clear stale branch preference for non-branch redirects.
      response.cookies.set("last_branch_path", "", { path: "/", maxAge: 0 });
    }
    return response;
  } catch (error: any) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json({ error: "Failed to login" }, { status: 500 });
  }
}
