import nodeCrypto from "crypto";

type MobileJwtType = "access" | "refresh";

type MobileJwtPayload = {
  sub: string;
  typ: MobileJwtType;
  iat: number;
  exp: number;
};

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return secret;
}

function getTtlSeconds(envKey: string, fallbackSeconds: number): number {
  const raw = process.env[envKey];
  if (!raw) return fallbackSeconds;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackSeconds;
}

const ACCESS_TTL_SECONDS = getTtlSeconds("MOBILE_ACCESS_TTL_SECONDS", 60 * 15);
const REFRESH_TTL_SECONDS = getTtlSeconds("MOBILE_REFRESH_TTL_SECONDS", 60 * 60 * 24 * 30);

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

function sign(content: string, secret: string): string {
  const signature = nodeCrypto.createHmac("sha256", secret).update(content).digest();
  return base64UrlEncode(signature);
}

function verifySignature(content: string, signatureB64: string, secret: string): boolean {
  const expected = nodeCrypto.createHmac("sha256", secret).update(content).digest();
  const actual = Buffer.from(signatureB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (expected.length !== actual.length) return false;
  return nodeCrypto.timingSafeEqual(expected, actual);
}

function createToken(userId: string, type: MobileJwtType, ttlSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const payload: MobileJwtPayload = {
    sub: userId,
    typ: type,
    iat: now,
    exp: now + ttlSeconds,
  };
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const content = `${headerB64}.${payloadB64}`;
  const signature = sign(content, getSecret());
  return { token: `${content}.${signature}`, expiresIn: ttlSeconds };
}

export function createAccessToken(userId: string) {
  return createToken(userId, "access", ACCESS_TTL_SECONDS);
}

export function createRefreshToken(userId: string) {
  return createToken(userId, "refresh", REFRESH_TTL_SECONDS);
}

export function verifyToken(token: string, expectedType: MobileJwtType): MobileJwtPayload | null {
  if (!token || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) return null;
  const content = `${headerB64}.${payloadB64}`;
  if (!verifySignature(content, signatureB64, getSecret())) return null;
  try {
    const payloadJson = base64UrlDecodeToString(payloadB64);
    const payload = JSON.parse(payloadJson) as MobileJwtPayload;
    if (!payload?.sub || !payload?.exp || !payload?.typ) return null;
    if (payload.typ !== expectedType) return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}
