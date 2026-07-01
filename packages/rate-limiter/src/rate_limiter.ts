import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

/**
 * Distributed rate limiter backed by Upstash Redis.
 * Works correctly across multiple serverless instances / edge regions,
 * unlike the old in-memory Map (which was per-instance only).
 *
 * Requires env vars:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

export interface RateLimiterOptions {
  windowMs?: number; // Time window in milliseconds
  maxRequests?: number; // Max requests per client within window
  getClientId?: (request: Request) => string; // Custom client ID extraction
  getKey?: (request: Request, clientId: string) => string; // Custom rate-limit key extraction
  redis?: Redis; // Optionally inject a Redis client (e.g. for testing)
  keyPrefix?: string; // Namespace prefix for Redis keys
  lockout?: LockoutOptions; // Optional progressive lockout after repeated failures
}

export interface LockoutOptions {
  // After this many failed attempts within `failWindowMs`, lock the key out.
  maxFailures: number;
  failWindowMs: number;
  // Lockout duration grows with each successive lockout, up to lockoutCapMs.
  baseLockoutMs: number;
  lockoutCapMs: number;
}

export interface RateLimitResult {
  limited: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
  lockedOut?: boolean;
  requireCaptcha?: boolean;
}

let shared_redis: Redis | null = null;
function get_shared_redis(): Redis {
  if (!shared_redis) {
    shared_redis = Redis.fromEnv(); // this gets the redis token
  }
  return shared_redis;
}

export class RateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private getClientId: (request: Request) => string;
  private getKey: (request: Request, clientId: string) => string;
  private redis: Redis;
  private keyPrefix: string;
  private lockout?: LockoutOptions;

  constructor(options: RateLimiterOptions = {}) {
    this.windowMs = options.windowMs ?? 60_000; // 1 minute
    this.maxRequests = options.maxRequests ?? 60;
    this.getClientId = options.getClientId ?? defaultClientIdExtractor;
    this.getKey = options.getKey ?? defaultKeyExtractor;
    this.redis = options.redis ?? get_shared_redis();
    this.keyPrefix = options.keyPrefix ?? 'rl';
    this.lockout = options.lockout;
  }

  /**
   * Checks (and increments) the rate limit counter for this request.
   * Uses a Redis fixed-window counter via INCR + PEXPIRE (atomic enough for
   * rate limiting purposes; a single race at the window boundary just lets
   * one extra request through, which is an acceptable tradeoff for speed).
   */
  async check(request: Request): Promise<RateLimitResult> {
    const clientId = this.getClientId(request) || 'unknown';
    const key = this.getKey(request, clientId);
    const redisKey = `${this.keyPrefix}:count:${key}`;

    // If this key is currently locked out, short-circuit before counting.
    if (this.lockout) {
      const lockedUntil = await this.redis.get<number>(`${this.keyPrefix}:lockout:${key}`);
      if (lockedUntil && lockedUntil > Date.now()) {
        return {
          limited: true,
          lockedOut: true,
          requireCaptcha: true,
          limit: this.maxRequests,
          remaining: 0,
          resetAt: lockedUntil,
          retryAfterMs: lockedUntil - Date.now(),
        };
      }
    }

    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      // First request in this window: set expiry.
      await this.redis.pexpire(redisKey, this.windowMs);
    }
    const pttl = await this.redis.pttl(redisKey);
    const retryAfterMs = pttl > 0 ? pttl : this.windowMs;
    const resetAt = Date.now() + retryAfterMs;

    const limited = count > this.maxRequests;
    const remaining = Math.max(this.maxRequests - count, 0);

    return { limited, limit: this.maxRequests, remaining, resetAt, retryAfterMs };
  }

  /**
   * Call this after a failed login/auth attempt to track failures separately
   * from general request volume. Triggers progressive lockout once the
   * failure threshold is exceeded within the failure window.
   */
  async recordFailure(request: Request): Promise<{ lockedOut: boolean; lockoutMs?: number }> {
    if (!this.lockout) return { lockedOut: false };

    const clientId = this.getClientId(request) || 'unknown';
    const key = this.getKey(request, clientId);
    const failKey = `${this.keyPrefix}:fail:${key}`;
    const lockoutCountKey = `${this.keyPrefix}:lockoutcount:${key}`;
    const lockoutKey = `${this.keyPrefix}:lockout:${key}`;

    const failures = await this.redis.incr(failKey);
    if (failures === 1) {
      await this.redis.pexpire(failKey, this.lockout.failWindowMs);
    }

    if (failures >= this.lockout.maxFailures) {
      // Escalate lockout duration each time this key gets locked out again,
      // capped at lockoutCapMs, to slow down persistent attackers.
      const priorLockouts = await this.redis.incr(lockoutCountKey);
      await this.redis.pexpire(lockoutCountKey, this.lockout.lockoutCapMs * 4);

      const lockoutMs = Math.min(
        this.lockout.baseLockoutMs * 2 ** (priorLockouts - 1),
        this.lockout.lockoutCapMs
      );

      const lockedUntil = Date.now() + lockoutMs;
      await this.redis.set(lockoutKey, lockedUntil, { px: lockoutMs });
      await this.redis.del(failKey); // reset failure count once locked out

      return { lockedOut: true, lockoutMs };
    }

    return { lockedOut: false };
  }

  /** Call this after a successful login to clear any failure history. */
  async recordSuccess(request: Request): Promise<void> {
    if (!this.lockout) return;
    const clientId = this.getClientId(request) || 'unknown';
    const key = this.getKey(request, clientId);
    await Promise.all([
      this.redis.del(`${this.keyPrefix}:fail:${key}`),
      this.redis.del(`${this.keyPrefix}:lockout:${key}`),
    ]);
  }
}

// ---------------------------------------------------------------------------
// Preconfigured limiters
// ---------------------------------------------------------------------------

/** General API traffic: generous limit, no lockout. */
export const generalLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 60,
  keyPrefix: 'rl:general',
});

/**
 * Login endpoint: much stricter than general traffic, keyed on IP + email
 * (so an attacker can't just rotate IPs against one account, or hammer many
 * accounts from one IP without tripping anything) and backed by progressive
 * lockout + a CAPTCHA flag after repeated failures.
 */
export const loginLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 5, // 5 attempts/min per IP+email pair
  keyPrefix: 'rl:login',
  getKey: (request, clientId) => {
    const url = new URL(request.url);
    // identifier is attached by the caller, see getLoginKeyWithIdentifier below;
    // fall back to IP-only if no identifier is available.
    const identifier = url.searchParams.get('__identifier') ?? 'no-identifier';
    return `login:${clientId}:${identifier}`;
  },
});

// Snake_case aliases for teams using Rust-style naming conventions.
export const general_limiter = generalLimiter;
export const login_limiter = loginLimiter;

/**
 * Helper to build a Request whose URL carries the login identifier (email)
 * so the default getKey above can read it. Use this in your login route
 * instead of calling loginLimiter.check(request) directly, since the
 * identifier (email) is normally only available after parsing the body.
 */
export function withLoginIdentifier(request: Request, identifier: string): Request {
  const url = new URL(request.url);
  url.searchParams.set('__identifier', identifier.trim().toLowerCase());

  // Avoid reusing a potentially consumed body stream from the original request.
  // Rate-limiter keying only needs URL, method, and headers.
  return new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
  });
}

export const with_login_identifier = withLoginIdentifier;

// ---------------------------------------------------------------------------
// Next.js helpers
// ---------------------------------------------------------------------------

/** Returns NextResponse when limited, otherwise null. */
export async function applyRateLimit(
  request: Request,
  limiter: RateLimiter,
  message?: string
): Promise<NextResponse | null> {
  const result = await limiter.check(request);

  if (result.limited) {
    const body: Record<string, unknown> = {
      message: message
        ? message
        : result.lockedOut
          ? 'Too many failed attempts. Please try again later or complete the CAPTCHA.'
          : 'Too many requests, please try again later.',
    };
    if (result.requireCaptcha) body.requireCaptcha = true;

    return NextResponse.json(body, {
      status: result.lockedOut ? 423 /* Locked */ : 429,
      headers: rateLimitHeaders(result),
    });
  }

  return null;
}

export const apply_rate_limit = applyRateLimit;

function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)),
  };
}

function defaultClientIdExtractor(request: Request): string {
  const headers = request.headers;
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }

  const cf_ip = headers.get('cf-connecting-ip');
  if (cf_ip) return cf_ip;

  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
}

function defaultKeyExtractor(request: Request, clientId: string): string {
  const url = new URL(request.url);
  return `${request.method}:${url.pathname}:${clientId}`;
}

/*
Usage in Next.js route:

General traffic:
  import { generalLimiter, applyRateLimit } from 'packages/rate-limiter';

  export async function GET(request: Request) {
    const limited = await applyRateLimit(request, generalLimiter);
    if (limited) return limited;
    return NextResponse.json({ ok: true });
  }

Login endpoint (IP + email keyed, with lockout/CAPTCHA):
  import { loginLimiter, withLoginIdentifier, applyRateLimit } from 'packages/rate-limiter';

  export async function POST(request: Request) {
    const { email, password } = await request.json();
    const keyedRequest = withLoginIdentifier(request, email);

    const limited = await applyRateLimit(keyedRequest, loginLimiter);
    if (limited) return limited;

    const ok = await verifyCredentials(email, password);
    if (!ok) {
      const { lockedOut } = await loginLimiter.recordFailure(keyedRequest);
      return NextResponse.json(
        { message: lockedOut ? 'Account temporarily locked.' : 'Invalid credentials.' },
        { status: 401 }
      );
    }

    await loginLimiter.recordSuccess(keyedRequest);
    // ... issue session
    return NextResponse.json({ ok: true });
  }
*/
