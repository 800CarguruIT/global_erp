export function getBaseUrl() {
  // On the client we can safely use relative URLs
  if (typeof window !== "undefined") {
    return "";
  }

  // Prefer explicit env vars if they exist
  const envBase =
    process.env.NEXT_PUBLIC_WEB_BASE_URL ||
    process.env.WEB_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL;

  const fallback = "http://localhost:3000";

  const base = (envBase || fallback).trim();

  // remove trailing slash
  return base.endsWith("/") ? base.slice(0, -1) : base;
}
