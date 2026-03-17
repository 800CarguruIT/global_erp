import { NextRequest } from "next/server";
import {
import { requireAuth } from "@/lib/auth/requireAuth";

  resolveWorkshopAccess,
  workshopErrorFromUnknown,
  workshopSuccess,
} from "./utils";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const access = resolveWorkshopAccess(req, "read");
    return workshopSuccess({
      service: "workshops-api",
      version: "v1",
      companyId: access.companyId,
      clientId: access.clientId,
      scopes: access.scopes,
      endpoints: [
        "/api/v1/workshops/work-orders",
        "/api/v1/workshops/inspections",
        "/api/v1/workshops/invoices",
      ],
    });
  } catch (error) {
    return workshopErrorFromUnknown(error);
  }
}
