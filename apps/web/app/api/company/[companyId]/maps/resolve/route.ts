import { NextRequest, NextResponse } from "next/server";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

type Params = { params: Promise<{ companyId: string }> };

const ALLOWED_HOSTS = new Set([
  "maps.app.goo.gl",
  "goo.gl",
  "google.com",
  "www.google.com",
  "maps.google.com",
]);

function isAllowedHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (ALLOWED_HOSTS.has(host)) return true;
  if (host.endsWith(".google.com")) return true;
  return false;
}

function extractMeta(html: string, attr: "property" | "name", key: string): string | null {
  const pattern = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["']`, "i");
  const match = html.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function parseLabelFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const q = parsed.searchParams.get("q") || parsed.searchParams.get("query") || "";
    const placeMatch = parsed.pathname.match(/\/place\/([^/]+)/i);
    const raw = (q || placeMatch?.[1] || "").replace(/\+/g, " ").trim();
    if (!raw) return null;
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

function parseCenterFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const atMatch = `${parsed.pathname}${parsed.search}`.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (atMatch?.[1] && atMatch?.[2]) return `${atMatch[1]},${atMatch[2]}`;
    const bangMatch = `${parsed.pathname}${parsed.search}`.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (bangMatch?.[1] && bangMatch?.[2]) return `${bangMatch[1]},${bangMatch[2]}`;
    const decodedPath = decodeURIComponent(parsed.pathname || "");
    const searchPathMatch = decodedPath.match(/\/maps\/search\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
    if (searchPathMatch?.[1] && searchPathMatch?.[2]) return `${searchPathMatch[1]},${searchPathMatch[2]}`;
    const ll = parsed.searchParams.get("ll");
    if (ll && /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(ll.trim())) return ll.trim();
    return null;
  } catch {
    return null;
  }
}

function parseCenterFromHtml(html: string): string | null {
  if (!html) return null;
  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i,
    /"lat"\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*"lng"\s*:\s*(-?\d+(?:\.\d+)?)/i,
    /"center"\s*:\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/i,
    /q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1] && match?.[2]) return `${match[1]},${match[2]}`;
  }
  return null;
}

async function resolveGoogleUrl(input: string): Promise<{ url: string; label: string | null; center: string | null }> {
  let current = input;
  let derivedLabel: string | null = parseLabelFromUrl(input);
  let derivedCenter: string | null = parseCenterFromUrl(input);

  for (let i = 0; i < 8; i += 1) {
    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: { "user-agent": "GlobalERP/MapResolver", accept: "text/html,application/xhtml+xml" },
    });

    const location = res.headers.get("location");
    if (location && res.status >= 300 && res.status < 400) {
      const nextUrl = new URL(location, current).toString();
      const parsedNext = new URL(nextUrl);
      if (!isAllowedHost(parsedNext.hostname)) {
        throw new Error("Resolved URL is not a Google Maps URL");
      }
      current = nextUrl;
      derivedLabel = derivedLabel || parseLabelFromUrl(current);
      continue;
    }

    if (res.status >= 200 && res.status < 300) {
      const html = await res.text();
      const ogUrl = extractMeta(html, "property", "og:url");
      const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
      const candidate = (ogUrl || canonicalMatch?.[1] || "").trim();
      if (candidate) {
        const absolute = new URL(candidate, current).toString();
        const parsed = new URL(absolute);
        if (isAllowedHost(parsed.hostname)) {
          current = absolute;
          derivedCenter = derivedCenter || parseCenterFromUrl(current);
        }
      }

      // Many short-map pages only expose coordinates in inline scripts/meta.
      derivedCenter = derivedCenter || parseCenterFromHtml(html);

      const ogTitle = extractMeta(html, "property", "og:title") || extractMeta(html, "name", "title");
      if (ogTitle) {
        const cleaned = ogTitle.replace(/\s*-\s*Google Maps\s*$/i, "").trim();
        if (cleaned) derivedLabel = derivedLabel || cleaned;
      }

      const inlineMapsUrlMatch = html.match(/https:\/\/www\.google\.[^"'\\\s]+\/maps\/[^\s"'\\<]+/i);
      if (inlineMapsUrlMatch?.[0]) {
        const parsed = new URL(inlineMapsUrlMatch[0]);
        if (isAllowedHost(parsed.hostname)) {
          current = parsed.toString();
          derivedLabel = derivedLabel || parseLabelFromUrl(current);
          derivedCenter = derivedCenter || parseCenterFromUrl(current);
        }
      }
      break;
    }

    break;
  }

  return { url: current, label: derivedLabel, center: derivedCenter };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
  const perm = await requirePermission(req, "leads.view", scopeCtx);
  if (perm) return perm;

  const raw = String(req.nextUrl.searchParams.get("url") ?? "").trim();
  if (!raw) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const input = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!isAllowedHost(parsed.hostname)) {
    return NextResponse.json({ error: "Only Google Maps URLs are allowed" }, { status: 400 });
  }

  try {
    const resolved = await resolveGoogleUrl(parsed.toString());
    const finalUrl = resolved.url || parsed.toString();
    let finalParsed: URL;
    try {
      finalParsed = new URL(finalUrl);
    } catch {
      return NextResponse.json({ error: "Failed to resolve map URL" }, { status: 502 });
    }
    if (!isAllowedHost(finalParsed.hostname)) {
      return NextResponse.json({ error: "Resolved URL is not a Google Maps URL" }, { status: 400 });
    }
    return NextResponse.json({
      data: { url: finalParsed.toString(), label: resolved.label ?? null, center: resolved.center ?? null },
    });
  } catch {
    return NextResponse.json({ error: "Failed to resolve map URL" }, { status: 502 });
  }
}
