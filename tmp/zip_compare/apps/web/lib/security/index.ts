import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Security headers applied to all API responses.
 * Import and call this in API routes that need extra protection,
 * or apply globally via next.config.js headers.
 */
export function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

/**
 * Simple in-memory rate limiter for API routes.
 * Not suitable for multi-instance deployments (use Redis-based limiter instead).
 * 
 * Usage:
 * ```ts
 * const limiter = createRateLimiter({ windowMs: 60_000, max: 60 });
 * 
 * export async function POST(req: NextRequest) {
 *   const limited = limiter(req);
 *   if (limited) return limited;
 *   // ... handle request
 * }
 * ```
 */
export function createRateLimiter(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Cleanup stale entries every 5 minutes
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now > entry.resetAt) hits.delete(key);
    }
  }, 5 * 60_000);

  // Avoid keeping the Node.js event loop alive solely for rate-limit cleanup.
  cleanupTimer.unref?.();

  return function rateLimitCheck(req: NextRequest): NextResponse | null {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";
    const now = Date.now();
    const entry = hits.get(ip);

    if (!entry || now > entry.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + opts.windowMs });
      return null;
    }

    entry.count++;
    if (entry.count > opts.max) {
      return NextResponse.json(
        { error: "Too many requests", retryAfter: Math.ceil((entry.resetAt - now) / 1000) },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
            "X-RateLimit-Limit": String(opts.max),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
    return null;
  };
}
