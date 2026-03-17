import nodeCrypto from "crypto";

export type IntegrationAccessTokenPayload = {
  iss: string;
  aud: string;
  sub: string;
  client_id: string;
  company_id: string | null;
  scope: string;
  typ: "integration_access";
  iat: number;
  exp: number;
  jti: string;
};

function getSecret(): string {
  const secret = process.env.INTEGRATION_AUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("INTEGRATION_AUTH_SECRET or AUTH_SECRET is required");
  }
  return secret;
}

function getIssuer(): string {
  return process.env.INTEGRATION_JWT_ISSUER ?? "global-erp";
}

function getAudience(): string {
  return process.env.INTEGRATION_JWT_AUDIENCE ?? "global-erp-api";
}

function getTtlSeconds(): number {
  const raw = process.env.INTEGRATION_ACCESS_TTL_SECONDS;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 60 * 15;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecodeToString(input: string): string {
  const pad = 4 - (input.length % 4 || 4);
  const padded = input + "=".repeat(pad === 4 ? 0 : pad);
  const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function base64UrlDecodeToBuffer(input: string): Buffer {
  const pad = 4 - (input.length % 4 || 4);
  const padded = input + "=".repeat(pad === 4 ? 0 : pad);
  const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}

function sign(content: string, secret: string): string {
  const signature = nodeCrypto.createHmac("sha256", secret).update(content).digest();
  return base64UrlEncode(signature);
}

function verifySignature(content: string, signatureB64: string, secret: string): boolean {
  const expected = nodeCrypto.createHmac("sha256", secret).update(content).digest();
  const actual = base64UrlDecodeToBuffer(signatureB64);
  if (expected.length !== actual.length) return false;
  return nodeCrypto.timingSafeEqual(expected, actual);
}

export function createIntegrationAccessToken(input: {
  clientId: string;
  companyId?: string | null;
  scopes: string[];
}) {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = getTtlSeconds();
  const payload: IntegrationAccessTokenPayload = {
    iss: getIssuer(),
    aud: getAudience(),
    sub: `client:${input.clientId}`,
    client_id: input.clientId,
    company_id: input.companyId ?? null,
    scope: input.scopes.join(" "),
    typ: "integration_access",
    iat: now,
    exp: now + expiresIn,
    jti: nodeCrypto.randomUUID(),
  };
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const content = `${headerB64}.${payloadB64}`;
  const signature = sign(content, getSecret());
  return { token: `${content}.${signature}`, expiresIn, payload };
}

export function verifyIntegrationAccessToken(token: string): IntegrationAccessTokenPayload | null {
  if (!token || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) return null;
  const content = `${headerB64}.${payloadB64}`;
  if (!verifySignature(content, signatureB64, getSecret())) return null;

  try {
    const payload = JSON.parse(
      base64UrlDecodeToString(payloadB64)
    ) as IntegrationAccessTokenPayload;
    if (!payload?.client_id || !payload?.typ || !payload?.exp || !payload?.iat) {
      return null;
    }
    if (payload.typ !== "integration_access") return null;
    if (payload.iss !== getIssuer() || payload.aud !== getAudience()) return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}
