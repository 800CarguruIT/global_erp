import { NextRequest } from "next/server";
import { resolveScopeFromPath } from "./resolve-scope";

export function getRequestScope(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  return resolveScopeFromPath(pathname);
}

export default getRequestScope;
