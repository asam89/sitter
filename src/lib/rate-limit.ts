// Tiny in-process rate limiter for unauthenticated endpoints.
//
// Good enough for a single container (which is how Ri'aya runs): it stops one
// browser or script from flooding problem reports and admin alerts. It is not a
// distributed limiter — behind several instances each holds its own counters.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) {
      buckets.forEach((b, k) => {
        if (b.resetAt <= now) buckets.delete(k);
      });
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }
  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
  };
}

// Best-effort client identity. nginx sits in front in production, so prefer the
// forwarded address and fall back to a constant (which just makes the limit
// global rather than per-client).
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
  return ip || "unknown";
}
