import type { Prisma } from '@prisma/client';
import type { AdminUpdateUserInput, Paginated, Pagination, Role, UserDto } from '@learnloop/shared';
import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/errors.js';
import { toPage, toSkipTake } from '../lib/pagination.js';
import type { Caller } from './access.js';
import { recordAudit } from './audit.js';
import { revokeAllForUser, toUserDto } from './auth.js';

export async function getMe(caller: Caller): Promise<UserDto> {
  const user = await prisma.user.findUnique({ where: { id: caller.id } });
  if (!user) throw notFound('User');
  return toUserDto(user);
}

export async function updateMe(caller: Caller, displayName: string): Promise<UserDto> {
  return toUserDto(await prisma.user.update({ where: { id: caller.id }, data: { displayName } }));
}

/** FR-5 / NFR-15: deleting an account removes the user's data via cascades. */
export async function deleteMe(caller: Caller): Promise<void> {
  if (caller.role === 'admin') {
    const admins = await prisma.user.count({ where: { role: 'admin', disabled: false } });
    if (admins <= 1) throw conflict('The last admin account cannot be deleted', 'LAST_ADMIN');
  }
  await prisma.user.delete({ where: { id: caller.id } });
  await recordAudit({ actorId: caller.id, action: 'user.deleted', target: `user:${caller.id}` });
}

export async function listUsers(
  filter: { role?: Role; q?: string },
  p: Pagination,
): Promise<Paginated<UserDto>> {
  const where: Prisma.UserWhereInput = {
    ...(filter.role ? { role: filter.role } : {}),
    ...(filter.q
      ? {
          OR: [
            { email: { contains: filter.q, mode: 'insensitive' } },
            { displayName: { contains: filter.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(p) }),
    prisma.user.count({ where }),
  ]);
  return toPage(rows.map(toUserDto), total, p);
}

/** FR-40: change role or disable. Admins cannot lock themselves out. */
export async function adminUpdateUser(
  id: string,
  caller: Caller,
  input: AdminUpdateUserInput,
): Promise<UserDto> {
  if (id === caller.id) throw conflict('You cannot change your own role or status', 'SELF_UPDATE');
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('User');

  const updated = await prisma.user.update({
    where: { id },
    data: { role: input.role, disabled: input.disabled },
  });

  if (input.role && input.role !== user.role) {
    await recordAudit({
      actorId: caller.id,
      action: 'user.role_changed',
      target: `user:${id}`,
      metadata: { from: user.role, to: input.role },
    });
  }
  if (input.disabled !== undefined && input.disabled !== user.disabled) {
    if (input.disabled) await revokeAllForUser(id);
    await recordAudit({
      actorId: caller.id,
      action: input.disabled ? 'user.disabled' : 'user.enabled',
      target: `user:${id}`,
    });
  }
  return toUserDto(updated);
}
