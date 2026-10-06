import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@learnloop/shared';
import { verifyAccessToken } from '../services/tokens.js';
import { prisma } from '../lib/prisma.js';
import { forbidden, unauthorized } from '../lib/errors.js';

/**
 * Verifies the bearer access token, then re-reads the user so a disabled account
 * or a changed role takes effect immediately instead of when the token expires.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized();
    const claims = verifyAccessToken(header.slice('Bearer '.length));
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, role: true, disabled: true },
    });
    if (!user || user.disabled) throw unauthorized('Session is no longer valid');
    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

/** Role check on the server for every protected request (FR-3, SEC-3). */
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
