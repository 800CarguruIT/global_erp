import { NextRequest } from "next/server";
import {
  type IntegrationAccessTokenPayload,
  verifyIntegrationAccessToken,
} from "./integration-jwt";

export function getIntegrationBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token.trim();
}

export function getIntegrationTokenPayload(req: NextRequest): IntegrationAccessTokenPayload | null {
  const token = getIntegrationBearerToken(req);
  if (!token) return null;
  return verifyIntegrationAccessToken(token);
}

function payloadScopes(payload: IntegrationAccessTokenPayload): string[] {
  return payload.scope
    .split(" ")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function hasRequiredScopes(
  payload: IntegrationAccessTokenPayload,
  requiredScopes: string[]
): boolean {
  if (!requiredScopes.length) return true;
  const granted = new Set(payloadScopes(payload));
  return requiredScopes.every((scope) => granted.has(scope));
}

export function requireIntegrationToken(
  req: NextRequest,
  options?: {
    requiredScopes?: string[];
  }
): IntegrationAccessTokenPayload {
  const payload = getIntegrationTokenPayload(req);
  if (!payload) {
    throw new Error("Unauthorized");
  }
  const requiredScopes = options?.requiredScopes ?? [];
  if (!hasRequiredScopes(payload, requiredScopes)) {
    throw new Error("Forbidden");
  }
  return payload;
}
