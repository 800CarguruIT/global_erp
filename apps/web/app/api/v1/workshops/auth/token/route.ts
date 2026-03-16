import { NextRequest, NextResponse } from "next/server";
import { IntegrationAuth } from "@repo/ai-core";
import { createIntegrationAccessToken } from "@/lib/auth/integration-jwt";

type ParsedTokenRequest = {
  grantType: string | null;
  clientId: string | null;
  clientSecret: string | null;
  scope: string | null;
};

function parseBasicAuth(req: NextRequest): { clientId: string; clientSecret: string } | null {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header || !header.startsWith("Basic ")) return null;
  const b64 = header.slice("Basic ".length).trim();
  if (!b64) return null;
  try {
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator <= 0) return null;
    const clientId = decoded.slice(0, separator).trim();
    const clientSecret = decoded.slice(separator + 1);
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret };
  } catch {
    return null;
  }
}

async function parseTokenRequest(req: NextRequest): Promise<ParsedTokenRequest> {
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  let grantType: string | null = null;
  let clientId: string | null = null;
  let clientSecret: string | null = null;
  let scope: string | null = null;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    grantType = form.get("grant_type")?.toString() ?? null;
    clientId = form.get("client_id")?.toString() ?? null;
    clientSecret = form.get("client_secret")?.toString() ?? null;
    scope = form.get("scope")?.toString() ?? null;
  } else {
    const body = await req.json().catch(() => null);
    grantType = body?.grant_type?.toString() ?? body?.grantType?.toString() ?? null;
    clientId = body?.client_id?.toString() ?? body?.clientId?.toString() ?? null;
    clientSecret = body?.client_secret?.toString() ?? body?.clientSecret?.toString() ?? null;
    scope = body?.scope?.toString() ?? null;
  }

  const basic = parseBasicAuth(req);
  if (basic) {
    clientId = basic.clientId;
    clientSecret = basic.clientSecret;
  }

  return { grantType, clientId, clientSecret, scope };
}

function parseScopes(scope: string | null): string[] {
  if (!scope) return [];
  return scope
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isSubset(subset: string[], superset: string[]): boolean {
  if (!subset.length) return true;
  const set = new Set(superset);
  return subset.every((value) => set.has(value));
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseTokenRequest(req);
    if (parsed.grantType !== "client_credentials") {
      return NextResponse.json(
        {
          error: "unsupported_grant_type",
          error_description: "grant_type must be client_credentials",
        },
        { status: 400 }
      );
    }
    if (!parsed.clientId || !parsed.clientSecret) {
      return NextResponse.json(
        {
          error: "invalid_client",
          error_description: "client_id and client_secret are required",
        },
        { status: 401 }
      );
    }

    const identity = await IntegrationAuth.validateIntegrationClientCredentials(
      parsed.clientId,
      parsed.clientSecret
    );
    if (!identity) {
      return NextResponse.json(
        {
          error: "invalid_client",
          error_description: "Invalid client credentials",
        },
        { status: 401 }
      );
    }

    const requestedScopes = parseScopes(parsed.scope);
    if (!isSubset(requestedScopes, identity.scopes)) {
      return NextResponse.json(
        {
          error: "invalid_scope",
          error_description: "Requested scope is not allowed for this client",
        },
        { status: 400 }
      );
    }
    const tokenScopes = requestedScopes.length ? requestedScopes : identity.scopes;
    const { token, expiresIn } = createIntegrationAccessToken({
      clientId: identity.clientId,
      companyId: identity.companyId,
      scopes: tokenScopes,
    });

    await IntegrationAuth.markIntegrationClientUsed(identity.clientId);

    return NextResponse.json({
      access_token: token,
      token_type: "Bearer",
      expires_in: expiresIn,
      scope: tokenScopes.join(" "),
      company_id: identity.companyId,
      api_base: "/api/v1/workshops",
    });
  } catch (error) {
    console.error("POST /api/v1/workshops/auth/token error:", error);
    return NextResponse.json(
      { error: "server_error", error_description: "Failed to issue access token" },
      { status: 500 }
    );
  }
}
