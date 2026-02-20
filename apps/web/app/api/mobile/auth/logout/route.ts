import { NextRequest } from "next/server";
import { createMobileSuccessResponse } from "../../utils";

export async function POST(_req: NextRequest) {
  // JWT auth is stateless; app clears stored tokens locally.
  return createMobileSuccessResponse({ ok: true });
}
