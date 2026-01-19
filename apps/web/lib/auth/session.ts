import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "./session-constants";
import nodeCrypto from "crypto";

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return secret;
}

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(input: string) {
  const pad = 4 - (input.length % 4 || 4);
  const padded = input + "=".repeat(pad === 4 ? 0 : pad);
  const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function base64UrlToBytes(input: string): Uint8Array {
  const pad = 4 - (input.length % 4 || 4);
  const padded = input + "=".repeat(pad === 4 ? 0 : pad);
  const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = Buffer.from(normalized, "base64");
  return new Uint8Array(binary);
}

export function createSessionToken(userId: string): string {
  const payload = JSON.stringify({ userId, iat: Date.now() });
  const secret = getSecret();
  const signature = nodeCrypto.createHmac("sha256", secret).update(payload).digest();
  return `${base64url(payload)}.${base64url(signature)}`;
}

export function verifySessionToken(token: string): { userId: string } | null {
  if (!token || !token.includes(".")) return null;
  const parts = token.split(".");
  const payloadB64 = parts[0];
  const sigB64 = parts[1];
  if (!payloadB64 || !sigB64) return null;
  try {
    const payloadJson = fromBase64Url(payloadB64);
    const payload = JSON.parse(payloadJson);
    const secret = getSecret();
    const expectedSig = nodeCrypto.createHmac("sha256", secret).update(payloadJson).digest();
    const actualSig = Buffer.from(sigB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    if (!nodeCrypto.timingSafeEqual(expectedSig, actualSig)) return null;
    if (!payload.userId) return null;
    return { userId: String(payload.userId) };
  } catch {
    return null;
  }
}

async function hmacSha256Bytes(message: string, secret: string): Promise<Uint8Array> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
    return new Uint8Array(sig);
  }
  const sig = nodeCrypto.createHmac("sha256", secret).update(message).digest();
  return new Uint8Array(sig);
}

function bytesEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    diff |= ai ^ bi;
  }
  return diff === 0;
}

export async function verifySessionTokenAsync(token: string): Promise<{ userId: string } | null> {
  if (!token || !token.includes(".")) return null;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;
  try {
    const payloadJson = fromBase64Url(payloadB64);
    const payload = JSON.parse(payloadJson);
    const secret = getSecret();
    const expectedSig = await hmacSha256Bytes(payloadJson, secret);
    const actualSig = base64UrlToBytes(sigB64);
    if (!bytesEqual(expectedSig, actualSig)) return null;
    if (!payload.userId) return null;
    return { userId: String(payload.userId) };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
