/**
 * In-memory sliding-window rate limiter, keyed by action + user id.
 *
 * Good enough for the current single-node deployment: state lives in this
 * process, so it resets on restart and is NOT shared between instances. If
 * the app is ever scaled horizontally, move this to Redis/Postgres.
 *
 * Server-only.
 */

export interface RateLimitRule {
  /** Max calls allowed within `windowMs`. */
  limit: number;
  windowMs: number;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Per-user limits for abuse-prone actions. */
export const RATE_LIMITS = {
  friendRequest: { limit: 30, windowMs: HOUR },
  searchUsers: { limit: 60, windowMs: MINUTE },
  interaction: { limit: 120, windowMs: MINUTE },
  upload: { limit: 20, windowMs: 10 * MINUTE },
  createEvent: { limit: 20, windowMs: HOUR },
  createOrg: { limit: 5, windowMs: HOUR },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

// Cached on globalThis so dev hot-reloads don't reset (or duplicate) the store.
const globalForRateLimit = globalThis as unknown as { __forumRateLimit?: Map<string, number[]> };
const hits: Map<string, number[]> = globalForRateLimit.__forumRateLimit ?? new Map();
globalForRateLimit.__forumRateLimit = hits;

const LONGEST_WINDOW_MS = Math.max(...Object.values(RATE_LIMITS).map((r) => r.windowMs));
const SWEEP_EVERY = 1000;
let callsSinceSweep = 0;

/** Drop keys with no hits inside the longest window, so the map can't grow without bound. */
function sweep(now: number) {
  for (const [key, timestamps] of hits) {
    const last = timestamps[timestamps.length - 1];
    if (last === undefined || now - last > LONGEST_WINDOW_MS) hits.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** When not ok: milliseconds until the oldest hit in the window expires. */
  retryAfterMs: number;
}

/** Record a hit for `name`/`userId` if under the limit. Denied calls are not recorded. */
export function checkRateLimit(
  name: RateLimitName,
  userId: string,
  rule: RateLimitRule = RATE_LIMITS[name],
  now: number = Date.now(),
): RateLimitResult {
  if (++callsSinceSweep >= SWEEP_EVERY) {
    callsSinceSweep = 0;
    sweep(now);
  }

  const key = `${name}:${userId}`;
  const windowStart = now - rule.windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (recent.length >= rule.limit) {
    hits.set(key, recent);
    const oldest = recent[0] ?? now;
    return { ok: false, retryAfterMs: Math.max(0, oldest + rule.windowMs - now) };
  }

  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfterMs: 0 };
}

/** Like `checkRateLimit`, but throws a user-facing Error when the limit is hit. */
export function enforceRateLimit(name: RateLimitName, userId: string): void {
  const result = checkRateLimit(name, userId);
  if (!result.ok) {
    const seconds = Math.ceil(result.retryAfterMs / 1000);
    throw new Error(`Too many requests. Please try again in ${seconds}s.`);
  }
}

/** Test helper: forget all recorded hits. */
export function resetRateLimits(): void {
  hits.clear();
}
