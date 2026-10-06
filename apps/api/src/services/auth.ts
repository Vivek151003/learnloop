import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import type { User } from '@prisma/client';
import type { LoginInput, RegisterInput, UserDto } from '@learnloop/shared';
import { prisma } from '../lib/prisma.js';
import { randomToken, sha256 } from '../lib/crypto.js';
import { AppError, conflict, unauthorized } from '../lib/errors.js';
import { sendMail } from '../lib/mailer.js';
import { config } from '../config.js';
import { recordAudit } from './audit.js';
import { signAccessToken } from './tokens.js';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

// Argon2id with OWASP-recommended parameters (SEC-1).
const ARGON_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export const hashPassword = (password: string) => argon2.hash(password, ARGON_OPTIONS);

// Verifying against a dummy hash when the email is unknown keeps response time
// the same, so login timing does not reveal which emails are registered.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword(randomToken()));

export function toUserDto(u: User): UserDto {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    disabled: u.disabled,
    createdAt: u.createdAt.toISOString(),
  };
}

export interface IssuedSession {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

async function issueSession(user: User, familyId: string = randomUUID()): Promise<IssuedSession> {
  const refreshToken = randomToken(48);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      familyId,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    },
  });
  return {
    user: toUserDto(user),
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    refreshToken,
    csrfToken: randomToken(),
  };
}

export async function register(input: RegisterInput): Promise<IssuedSession> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict('An account with this email already exists', 'EMAIL_TAKEN');
  const user = await prisma.user.create({
    data: {
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      passwordHash: await hashPassword(input.password),
    },
  });
  await recordAudit({ actorId: user.id, action: 'user.registered', target: `user:${user.id}` });
  return issueSession(user);
}

export async function login(input: LoginInput, ip: string | undefined): Promise<IssuedSession> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const ok = await argon2.verify(user?.passwordHash ?? (await getDummyHash()), input.password);
  if (!user || !ok) {
    await recordAudit({
      actorId: user?.id ?? null,
      action: 'auth.login_failed',
      metadata: { ip, knownUser: Boolean(user) },
    });
    throw unauthorized('Email or password is incorrect', 'INVALID_CREDENTIALS');
  }
  if (user.disabled) throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
  await recordAudit({ actorId: user.id, action: 'auth.login', metadata: { ip } });
  return issueSession(user);
}

/**
 * Rotates the refresh token (SEC-2). A token that was already rotated or revoked
 * means it was stolen or replayed, so the whole family is revoked.
 */
export async function refresh(presented: string | undefined): Promise<IssuedSession> {
  if (!presented) throw unauthorized('No refresh token', 'NO_REFRESH_TOKEN');
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(presented) },
    include: { user: true },
  });
  if (!stored) throw unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');

  if (stored.revokedAt) {
    await revokeFamily(stored.familyId);
    await recordAudit({
      actorId: stored.userId,
      action: 'auth.refresh_reuse',
      metadata: { familyId: stored.familyId },
    });
    throw unauthorized('Refresh token reuse detected; please log in again', 'TOKEN_REUSE');
  }
  if (stored.expiresAt < new Date() || stored.user.disabled) {
    await revokeFamily(stored.familyId);
    throw unauthorized('Session expired', 'SESSION_EXPIRED');
  }

  // Conditional update so two concurrent refreshes cannot both succeed.
  const revoked = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (revoked.count === 0) {
    await revokeFamily(stored.familyId);
    throw unauthorized('Refresh token reuse detected; please log in again', 'TOKEN_REUSE');
  }
  return issueSession(stored.user, stored.familyId);
}

export async function logout(presented: string | undefined): Promise<void> {
  if (!presented) return;
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(presented) } });
  if (!stored) return;
  await revokeFamily(stored.familyId);
  await recordAudit({ actorId: stored.userId, action: 'auth.logout' });
}

async function revokeFamily(familyId: string) {
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllForUser(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Always succeeds from the caller's view, so it cannot be used to find accounts (FR-4). */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.disabled) return;
  const token = randomToken(32);
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });
  const link = `${config.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: user.email,
    subject: 'Reset your LearnLoop password',
    text: `Use this link within 30 minutes to choose a new password: ${link}\nIf you did not ask for this, ignore this email.`,
  });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const stored = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
  });
  if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'This reset link is invalid or has expired');
  }
  const passwordHash = await hashPassword(password);
  // Mark used and change the password together, so a link works at most once.
  const used = await prisma.$transaction(async (tx) => {
    const marked = await tx.passwordResetToken.updateMany({
      where: { id: stored.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (marked.count === 0) return false;
    await tx.user.update({ where: { id: stored.userId }, data: { passwordHash } });
    return true;
  });
  if (!used)
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'This reset link has already been used');
  await revokeAllForUser(stored.userId);
  await recordAudit({ actorId: stored.userId, action: 'auth.password_reset' });
}
