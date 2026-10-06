import type { NextFunction, Request, Response } from 'express';
import {
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
  type RateLimiterAbstract,
} from 'rate-limiter-flexible';
import { redis } from '../lib/redis.js';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';

export interface LimitOptions {
  keyPrefix: string;
  points: number;
  durationSec: number;
  /** Returns the key to count against, or null to skip this limiter for the request. */
  key: (req: Request) => string | null;
}

function createLimiter(o: LimitOptions): RateLimiterAbstract {
  const opts = { keyPrefix: `rl:${o.keyPrefix}`, points: o.points, duration: o.durationSec };
  if (!redis) return new RateLimiterMemory(opts);
  // If Redis goes away, keep limiting in memory rather than failing open.
  return new RateLimiterRedis({
    ...opts,
    storeClient: redis,
    insuranceLimiter: new RateLimiterMemory(opts),
  });
}

/** Rate limit middleware backed by Redis (SEC-8). */
export function rateLimit(o: LimitOptions) {
  const limiter = createLimiter(o);
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = o.key(req);
    if (!key) return next();
    try {
      await limiter.consume(key);
      next();
    } catch (err) {
      if (err instanceof RateLimiterRes) {
        res.setHeader('Retry-After', String(Math.ceil(err.msBeforeNext / 1000)));
        return next(new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later'));
      }
      next(err);
    }
  };
}

const window = config.AUTH_RATE_LIMIT_WINDOW_SEC;
const points = config.AUTH_RATE_LIMIT_POINTS;

const emailFromBody = (req: Request): string | null => {
  const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? email.trim().toLowerCase().slice(0, 254) : null;
};

/** Per IP and per account limits for login, signup, reset and join-code guessing. */
export const authLimiters = {
  perIp: rateLimit({ keyPrefix: 'auth-ip', points, durationSec: window, key: (r) => r.ip ?? null }),
  perAccount: rateLimit({
    keyPrefix: 'auth-acct',
    points: Math.max(5, Math.floor(points / 2)),
    durationSec: window,
    key: emailFromBody,
  }),
  joinPerUser: rateLimit({
    keyPrefix: 'join-user',
    points,
    durationSec: window,
    key: (r) => r.user?.id ?? r.ip ?? null,
  }),
};
