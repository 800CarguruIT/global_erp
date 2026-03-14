import { NextRequest } from "next/server";
import { resolveRsaAccess, rsaErrorFromUnknown, rsaSuccess } from "./utils";

export async function GET(req: NextRequest) {
  try {
    const access = await resolveRsaAccess(req);
    return rsaSuccess({
      service: "rsa-api",
      version: "v1",
      companyId: access.companyId,
      endpoints: [
        "/api/v1/rsa/leads/assigned",
        "/api/v1/rsa/earnings/workshops",
        "/api/v1/rsa/earnings/vendors",
        "/api/v1/rsa/parts/quotes",
      ],
    });
  } catch (error) {
    return rsaErrorFromUnknown(error);
  }
}
