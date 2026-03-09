import { NextRequest } from "next/server";
import {
  resolveWorkshopAccess,
  workshopErrorFromUnknown,
  workshopSuccess,
} from "./utils";

export async function GET(req: NextRequest) {
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
