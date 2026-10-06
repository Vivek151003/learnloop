import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import type { Role } from '@learnloop/shared';
import { config } from '../config.js';
import { unauthorized } from '../lib/errors.js';
import { ROLES } from '@learnloop/shared';

export const REFRESH_COOKIE = 'll_refresh';
export const CSRF_COOKIE = 'll_csrf';
const REFRESH_PATH = '/api/v1/auth';
const ISSUER = 'learnloop-api';
const AUDIENCE = 'learnloop';

export interface AccessClaims {
  sub: string;
  role: Role;
}

/** Short-lived access token, at most 15 minutes (SEC-2). */
export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign({ role: claims.role }, config.JWT_SECRET, {
    subject: claims.sub,
    expiresIn: config.ACCESS_TOKEN_TTL_SEC,
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    if (
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      !ROLES.includes(payload.role as Role)
    ) {
      throw new Error('bad claims');
    }
    return { sub: payload.sub, role: payload.role as Role };
  } catch {
    throw unauthorized('Invalid or expired access token', 'INVALID_TOKEN');
  }
}

const baseCookie = () => ({
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: 'strict' as const,
});

/** Refresh token and CSRF token both live in HttpOnly, SameSite=strict cookies (FR-2, SEC-10). */
export function setSessionCookies(res: Response, refreshToken: string, csrfToken: string) {
  const maxAge = config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  res.cookie(REFRESH_COOKIE, refreshToken, { ...baseCookie(), path: REFRESH_PATH, maxAge });
  res.cookie(CSRF_COOKIE, csrfToken, { ...baseCookie(), path: '/', maxAge });
}

export function clearSessionCookies(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie(), path: REFRESH_PATH });
  res.clearCookie(CSRF_COOKIE, { ...baseCookie(), path: '/' });
}
