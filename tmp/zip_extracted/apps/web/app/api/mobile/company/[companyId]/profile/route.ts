import { NextRequest } from "next/server";
import { getCompanyById, listCompanyContacts } from "@repo/ai-core/company/service";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const company = await getCompanyById(companyId);
    const contacts = await listCompanyContacts(companyId).catch(() => []);

    return createMobileSuccessResponse({
      profile: company
        ? {
            id: company.id,
            displayName: company.display_name ?? null,
            legalName: company.legal_name ?? null,
            companyPhone: company.company_phone ?? null,
            companyEmail: company.company_email ?? null,
            googleLocation: company.google_location ?? null,
            address: {
              line1: company.address_line1 ?? null,
              line2: company.address_line2 ?? null,
              city: company.city ?? null,
              stateRegion: company.state_region ?? null,
              postalCode: company.postal_code ?? null,
              country: company.country ?? null,
            },
            contacts,
          }
        : null,
    });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/profile error:", error);
    return handleMobileError(error);
  }
}
