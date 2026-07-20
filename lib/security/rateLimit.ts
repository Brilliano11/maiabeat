import "server-only";

export type RateLimitPolicy = {
  namespace: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function removeExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function removeOldestBucket() {
  let oldestKey: string | null = null;
  let oldestReset = Number.POSITIVE_INFINITY;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < oldestReset) {
      oldestKey = key;
      oldestReset = bucket.resetAt;
    }
  }

  if (oldestKey) buckets.delete(oldestKey);
}

export function consumeRateLimit(
  identifier: string,
  policy: RateLimitPolicy,
  now = Date.now(),
): RateLimitResult {
  if (buckets.size >= MAX_BUCKETS) {
    removeExpiredBuckets(now);
    if (buckets.size >= MAX_BUCKETS) removeOldestBucket();
  }

  const key = `${policy.namespace}:${identifier}`;
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + policy.windowMs }
    : current;

  bucket.count += 1;
  buckets.set(key, bucket);

  return {
    allowed: bucket.count <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}
