import type { Prisma } from '@prisma/client';
import type { AuditLogDto, Paginated, Pagination } from '@learnloop/shared';
import { prisma } from '../lib/prisma.js';
import { sha256, stableStringify } from '../lib/crypto.js';
import { toPage, toSkipTake } from '../lib/pagination.js';

export const GENESIS_HASH = '0'.repeat(64);
// Arbitrary constant key for the Postgres advisory lock that serialises appends.
const AUDIT_LOCK_KEY = 7_272_701;

export type AuditAction =
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.refresh_reuse'
  | 'auth.password_reset'
  | 'user.registered'
  | 'user.deleted'
  | 'user.role_changed'
  | 'user.disabled'
  | 'user.enabled'
  | 'class.created'
  | 'class.archived'
  | 'class.join_code_rotated'
  | 'question.created'
  | 'question.status_changed'
  | 'quiz.created'
  | 'assignment.created';

export interface AuditEntry {
  actorId: string | null;
  action: AuditAction;
  target?: string | null;
  metadata?: Record<string, unknown>;
}

interface HashInput {
  prevHash: string;
  actorId: string | null;
  action: string;
  target: string | null;
  metadata: unknown;
  createdAt: Date;
}

export function computeAuditHash(e: HashInput): string {
  return sha256(
    stableStringify({
      prevHash: e.prevHash,
      actorId: e.actorId,
      action: e.action,
      target: e.target,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
    }),
  );
}

/**
 * Appends to the tamper-evident audit log (SEC-14). Each row stores the hash of
 * the row before it, so editing or deleting any row breaks the chain, which
 * verifyAuditChain() detects. An advisory lock keeps concurrent appends in order.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  const metadata = (entry.metadata ?? {}) as Prisma.InputJsonObject;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_LOCK_KEY}::bigint)`;
    const last = await tx.auditLog.findFirst({ orderBy: { seq: 'desc' }, select: { hash: true } });
    const prevHash = last?.hash ?? GENESIS_HASH;
    const createdAt = new Date();
    const target = entry.target ?? null;
    const hash = computeAuditHash({
      prevHash,
      actorId: entry.actorId,
      action: entry.action,
      target,
      metadata,
      createdAt,
    });
    await tx.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        target,
        metadata,
        prevHash,
        hash,
        createdAt,
      },
    });
  });
}

/** Walks the chain in order and reports the first row whose hash does not match. */
export async function verifyAuditChain(): Promise<{
  valid: boolean;
  checked: number;
  brokenAtSeq?: number;
}> {
  let prevHash = GENESIS_HASH;
  let checked = 0;
  let cursor = 0;
  for (;;) {
    const rows = await prisma.auditLog.findMany({
      where: { seq: { gt: cursor } },
      orderBy: { seq: 'asc' },
      take: 500,
    });
    if (rows.length === 0) break;
    for (const row of rows) {
      const expected = computeAuditHash({ ...row, prevHash });
      if (row.prevHash !== prevHash || row.hash !== expected) {
        return { valid: false, checked, brokenAtSeq: row.seq };
      }
      prevHash = row.hash;
      cursor = row.seq;
      checked++;
    }
  }
  return { valid: true, checked };
}

export async function listAudit(
  filter: { action?: string; actorId?: string },
  p: Pagination,
): Promise<Paginated<AuditLogDto>> {
  const where: Prisma.AuditLogWhereInput = {
    ...(filter.action ? { action: { startsWith: filter.action } } : {}),
    ...(filter.actorId ? { actorId: filter.actorId } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { seq: 'desc' }, ...toSkipTake(p) }),
    prisma.auditLog.count({ where }),
  ]);
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((id): id is string => !!id))];
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, email: true },
  });
  const emailById = new Map(actors.map((a) => [a.id, a.email]));
  return toPage(
    rows.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      actorEmail: r.actorId ? (emailById.get(r.actorId) ?? null) : null,
      action: r.action,
      target: r.target,
      metadata: r.metadata as Record<string, unknown>,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    p,
  );
}
