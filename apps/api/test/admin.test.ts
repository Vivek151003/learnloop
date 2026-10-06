import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { verifyAuditChain } from '../src/services/audit.js';
import { api, PASSWORD, resetDb, userSession } from './helpers.js';

beforeEach(resetDb);

describe('user administration (FR-40)', () => {
  it('changes roles and disables users, with audit entries', async () => {
    const admin = await userSession('admin');
    const { user } = await userSession('student');

    const promoted = await api()
      .patch(`/api/v1/admin/users/${user.id}`)
      .set(admin.session.auth)
      .send({ role: 'teacher' });
    expect(promoted.body.role).toBe('teacher');
    const disabled = await api()
      .patch(`/api/v1/admin/users/${user.id}`)
      .set(admin.session.auth)
      .send({ disabled: true });
    expect(disabled.body.disabled).toBe(true);
    expect(
      (await api().post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD }))
        .status,
    ).toBe(403);

    const audit = await api().get('/api/v1/admin/audit?action=user.').set(admin.session.auth);
    expect(audit.body.items.map((e: { action: string }) => e.action)).toEqual([
      'user.disabled',
      'user.role_changed',
    ]);
    expect(audit.body.items[1].metadata).toEqual({ from: 'student', to: 'teacher' });
  });

  it('stops admins from changing themselves', async () => {
    const admin = await userSession('admin');
    const res = await api()
      .patch(`/api/v1/admin/users/${admin.user.id}`)
      .set(admin.session.auth)
      .send({ role: 'student' });
    expect(res.status).toBe(409);
  });

  it('searches and paginates users', async () => {
    const admin = await userSession('admin');
    for (let i = 0; i < 3; i++) await userSession('student');
    const res = await api()
      .get('/api/v1/admin/users?role=student&pageSize=2')
      .set(admin.session.auth);
    expect(res.body).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(res.body.items).toHaveLength(2);
  });
});

describe('audit log (FR-41, SEC-14)', () => {
  it('is hash-chained and verifies', async () => {
    const admin = await userSession('admin');
    await userSession('teacher');
    const res = await api().get('/api/v1/admin/audit/verify').set(admin.session.auth);
    expect(res.body.valid).toBe(true);
    expect(res.body.checked).toBeGreaterThanOrEqual(2);
  });

  it('cannot be edited or deleted, even directly in the database', async () => {
    await userSession('admin');
    await expect(
      prisma.$executeRawUnsafe(`UPDATE audit_logs SET action = 'tampered'`),
    ).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe('DELETE FROM audit_logs')).rejects.toThrow(/append-only/);
  });

  it('detects tampering if the trigger is bypassed', async () => {
    await userSession('admin');
    await userSession('teacher');
    await prisma.$transaction([
      prisma.$executeRawUnsafe(
        'ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_update_delete',
      ),
      prisma.$executeRawUnsafe(
        `UPDATE audit_logs SET action = 'tampered' WHERE seq = (SELECT MIN(seq) FROM audit_logs)`,
      ),
      prisma.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_update_delete'),
    ]);
    const result = await verifyAuditChain();
    expect(result.valid).toBe(false);
  });
});
