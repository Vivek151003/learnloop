import type { NextFunction, Request, Response } from 'express';
import { safeEqual } from '../lib/crypto.js';
import { AppError } from '../lib/errors.js';
import { CSRF_COOKIE, REFRESH_COOKIE } from '../services/tokens.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Endpoints that start or restore a session, so the client cannot hold a CSRF
// token yet (for example after a page reload). They stay protected by
// SameSite=strict cookies and the CORS allow-list, and their responses cannot
// be read cross-site. See SECURITY.md.
const EXEMPT_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

/**
 * Double-submit CSRF check (SEC-10). Browser sessions carry SameSite=strict
 * cookies plus a token the client echoes in the X-CSRF-Token header. Requests
 * that carry no session cookies (for example the MCP server using a bearer
 * token) cannot be forged by a third-party site, so they pass through.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.has(req.path)) return next();
  const cookies = req.cookies as Record<string, string | undefined>;
  if (!cookies[REFRESH_COOKIE] && !cookies[CSRF_COOKIE]) return next();
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return next(new AppError(403, 'CSRF_FAILED', 'Missing or invalid CSRF token'));
  }
  next();
}
