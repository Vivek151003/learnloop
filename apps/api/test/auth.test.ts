import { beforeEach, describe, expect, it } from 'vitest';
import { testOutbox } from '../src/lib/mailer.js';
import { prisma } from '../src/lib/prisma.js';
import { api, createUser, login, PASSWORD, resetDb } from './helpers.js';

const refreshCookie = (cookies: string[]) =>
  cookies.find((c) => c.startsWith('ll_refresh='))!.split(';')[0]!;

beforeEach(resetDb);

describe('register and login (FR-1, SEC-1)', () => {
  it('registers a student, hashes the password with argon2id, and starts a session', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'New@Test.dev', password: PASSWORD, displayName: 'New Kid' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'new@test.dev', role: 'student' });
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body).not.toHaveProperty('user.passwordHash');
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'new@test.dev' } });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.find((c) => c.startsWith('ll_refresh='))).toMatch(/HttpOnly.*SameSite=Strict/i);
  });

  it('rejects duplicate emails, short passwords, unknown fields and admin self-registration', async () => {
    await createUser('student', { email: 'taken@test.dev' });
    const dup = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'taken@test.dev', password: PASSWORD, displayName: 'X' });
    expect(dup.status).toBe(409);
    const short = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'a@test.dev', password: 'short', displayName: 'X' });
    expect(short.status).toBe(400);
    expect(short.body.details[0].path).toBe('password');
    const extra = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'b@test.dev', password: PASSWORD, displayName: 'X', isAdmin: true });
    expect(extra.status).toBe(400);
    const admin = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'c@test.dev', password: PASSWORD, displayName: 'X', role: 'admin' });
    expect(admin.status).toBe(400);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await createUser('student', { email: 'known@test.dev' });
    const wrong = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'known@test.dev', password: 'nope-nope-nope' });
    const unknown = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@test.dev', password: 'nope-nope-nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
    expect(await prisma.auditLog.count({ where: { action: 'auth.login_failed' } })).toBe(2);
  });

  it('blocks disabled accounts', async () => {
    const u = await createUser('student');
    await prisma.user.update({ where: { id: u.id }, data: { disabled: true } });
    const res = await api().post('/api/v1/auth/login').send({ email: u.email, password: PASSWORD });
    expect(res.status).toBe(403);
  });
});

describe('access and refresh tokens (FR-2, SEC-2)', () => {
  it('requires a valid bearer token', async () => {
    expect((await api().get('/api/v1/me')).status).toBe(401);
    const bad = await api().get('/api/v1/me').set('Authorization', 'Bearer not-a-jwt');
    expect(bad.status).toBe(401);
    expect(bad.body.code).toBe('INVALID_TOKEN');
  });

  it('rotates refresh tokens and revokes the family when an old one is reused', async () => {
    const u = await createUser('student');
    const s = await login(u.email);
    const first = refreshCookie(s.cookies);

    const r1 = await api().post('/api/v1/auth/refresh').set('Cookie', first).send({});
    expect(r1.status).toBe(200);
    const second = refreshCookie(([] as string[]).concat(r1.headers['set-cookie'] ?? []));
    expect(second).not.toBe(first);

    // Replaying the first (already rotated) token is treated as theft.
    const replay = await api().post('/api/v1/auth/refresh').set('Cookie', first).send({});
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('TOKEN_REUSE');

    // ...and the legitimate newer token is now revoked too.
    const after = await api().post('/api/v1/auth/refresh').set('Cookie', second).send({});
    expect(after.status).toBe(401);
    // Both replays of revoked tokens are audited.
    expect(await prisma.auditLog.count({ where: { action: 'auth.refresh_reuse' } })).toBe(2);
  });

  it('logout revokes the session and needs the CSRF token (SEC-10)', async () => {
    const u = await createUser('student');
    const s = await login(u.email);
    const noCsrf = await api()
      .post('/api/v1/auth/logout')
      .set(
        'Cookie',
        s.cookies.map((c) => c.split(';')[0]!),
      )
      .send({});
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.code).toBe('CSRF_FAILED');

    const ok = await api()
      .post('/api/v1/auth/logout')
      .set(
        'Cookie',
        s.cookies.map((c) => c.split(';')[0]!),
      )
      .set('X-CSRF-Token', s.csrf)
      .send({});
    expect(ok.status).toBe(204);
    const r = await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie(s.cookies))
      .send({});
    expect(r.status).toBe(401);
  });
});

describe('password reset (FR-4)', () => {
  it('sends a single-use link and does not reveal unknown emails', async () => {
    const u = await createUser('student');
    testOutbox.length = 0;

    const unknown = await api()
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@test.dev' });
    expect(unknown.status).toBe(202);
    expect(testOutbox).toHaveLength(0);

    const res = await api().post('/api/v1/auth/forgot-password').send({ email: u.email });
    expect(res.status).toBe(202);
    expect(res.body.message).toBe(unknown.body.message);
    const token = decodeURIComponent(/token=([^\s]+)/.exec(testOutbox[0]!.text)![1]!);

    const newPassword = 'a brand new passphrase';
    expect(
      (await api().post('/api/v1/auth/reset-password').send({ token, password: newPassword }))
        .status,
    ).toBe(204);
    expect(
      (await api().post('/api/v1/auth/reset-password').send({ token, password: newPassword }))
        .status,
    ).toBe(400);
    expect(
      (await api().post('/api/v1/auth/login').send({ email: u.email, password: PASSWORD })).status,
    ).toBe(401);
    expect(
      (await api().post('/api/v1/auth/login').send({ email: u.email, password: newPassword }))
        .status,
    ).toBe(200);
  });

  it('rejects expired tokens', async () => {
    const u = await createUser('student');
    testOutbox.length = 0;
    await api().post('/api/v1/auth/forgot-password').send({ email: u.email });
    const token = decodeURIComponent(/token=([^\s]+)/.exec(testOutbox[0]!.text)![1]!);
    await prisma.passwordResetToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await api()
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'another long passphrase' });
    expect(res.status).toBe(400);
  });
});

describe('profile (FR-5)', () => {
  it('reads, edits and deletes own account', async () => {
    const u = await createUser('student');
    const s = await login(u.email);
    expect((await api().get('/api/v1/me').set(s.auth)).body.email).toBe(u.email);
    const patched = await api().patch('/api/v1/me').set(s.auth).send({ displayName: 'Renamed' });
    expect(patched.body.displayName).toBe('Renamed');
    expect((await api().patch('/api/v1/me').set(s.auth).send({ role: 'admin' })).status).toBe(400);
    expect((await api().delete('/api/v1/me').set(s.auth)).status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: u.id } })).toBeNull();
    expect((await api().get('/api/v1/me').set(s.auth)).status).toBe(401);
  });
});

describe('errors and headers (SEC-7, SEC-13)', () => {
  it('returns the standard error shape without internals', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(Object.keys(res.body).sort()).toEqual(['code', 'message', 'requestId']);
    expect(JSON.stringify(res.body)).not.toMatch(/at |stack|SELECT/);
  });

  it('sets security headers and a request id', async () => {
    const res = await api().get('/api/v1/health');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('only allows CORS from known origins', async () => {
    const good = await api().get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(good.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const evil = await api().get('/api/v1/health').set('Origin', 'https://evil.example');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });
});
