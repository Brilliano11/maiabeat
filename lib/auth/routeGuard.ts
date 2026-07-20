import "server-only";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { consumeRateLimit, type RateLimitPolicy } from "@/lib/security/rateLimit";

const defaultApiPolicy: RateLimitPolicy = {
  namespace: "api",
  limit: 240,
  windowMs: 60_000,
};

type RequireUserOptions = {
  rateLimit?: RateLimitPolicy | false;
};

export async function requireUser(options: RequireUserOptions = {}) {
  const { user } = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Login required." }, { status: 401 }),
    };
  }

  const policy = options.rateLimit === false
    ? null
    : options.rateLimit ?? defaultApiPolicy;

  if (policy) {
    const rateLimit = consumeRateLimit(user.id, policy);
    if (!rateLimit.allowed) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "Too many requests. Please try again shortly." },
          {
            status: 429,
            headers: {
              "RateLimit-Limit": String(rateLimit.limit),
              "RateLimit-Remaining": String(rateLimit.remaining),
              "RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
              "Retry-After": String(rateLimit.retryAfterSeconds),
            },
          },
        ),
      };
    }
  }

  return { user, response: null };
}
