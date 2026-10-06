// BRIXTA_LOGIN_THROTTLE_V1
//
// Slows down password guessing on login, company switch and signup.
// Counts failures per account and per client address inside a time
// window. In-memory per server process: no database change needed, and a
// restart simply forgets the counters.
import "server-only";

import type { NextRequest } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

type Rule = {
  key: string;
  limit: number;
  windowMs: number;
};

const globalStore = globalThis as typeof globalThis & {
  __brixtaLoginThrottle?: Map<string, Bucket>;
};

const buckets: Map<string, Bucket> =
  globalStore.__brixtaLoginThrottle ??
  (globalStore.__brixtaLoginThrottle = new Map());

const MAX_BUCKETS = 50_000;

function sweep(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still full (an attack with many keys): drop the oldest half.
  if (buckets.size >= MAX_BUCKETS) {
    let drop = Math.floor(buckets.size / 2);
    for (const key of buckets.keys()) {
      buckets.delete(key);
      drop -= 1;
      if (drop <= 0) break;
    }
  }
}

export function clientAddress(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return (
    first ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

const MINUTE = 60_000;

/** Rules used by dashboard login and company switching. */
export function loginRules(input: {
  scope: string;
  address: string;
  account: string;
}): Rule[] {
  const account = input.account.trim().toLowerCase();
  return [
    {
      key: `${input.scope}:acct:${account}`,
      limit: 8,
      windowMs: 15 * MINUTE,
    },
    {
      key: `${input.scope}:ip:${input.address}`,
      limit: 40,
      windowMs: 15 * MINUTE,
    },
  ];
}

/** Returns seconds to wait if any rule is exhausted, otherwise 0. */
export function throttleWait(rules: Rule[]) {
  const now = Date.now();
  let wait = 0;
  for (const rule of rules) {
    const bucket = buckets.get(rule.key);
    if (!bucket || bucket.resetAt <= now) continue;
    if (bucket.count >= rule.limit) {
      wait = Math.max(wait, Math.ceil((bucket.resetAt - now) / 1000));
    }
  }
  return wait;
}

/** Count one failed attempt against every rule. */
export function recordFailure(rules: Rule[]) {
  const now = Date.now();
  sweep(now);
  for (const rule of rules) {
    const bucket = buckets.get(rule.key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(rule.key, { count: 1, resetAt: now + rule.windowMs });
    } else {
      bucket.count += 1;
    }
  }
}

/** Successful sign-in clears the account counter (not the address one). */
export function clearAccountFailures(rules: Rule[]) {
  for (const rule of rules) {
    if (rule.key.includes(":acct:")) buckets.delete(rule.key);
  }
}

/** Plain counter for actions that should be rare (e.g. company signup). */
export function consumeAttempt(rule: Rule) {
  const wait = throttleWait([rule]);
  if (wait > 0) return wait;
  recordFailure([rule]);
  return 0;
}

export function tooManyAttemptsMessage(waitSeconds: number) {
  const minutes = Math.max(1, Math.ceil(waitSeconds / 60));
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
