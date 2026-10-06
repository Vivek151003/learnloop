import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { ROLES, type Role } from '@learnloop/shared';
import { modules } from '../src/routes/index.js';
import { api, resetDb, userSession, type Session } from './helpers.js';

// TST-2: generated from the route table, so every new endpoint is covered
// automatically for unauthenticated (401) and wrong-role (403) calls.
const routes = modules.flatMap((m) =>
  m.routes.map((r) => ({
    ...r,
    url: `/api/v1${m.basePath}${r.path === '/' ? '' : r.path}`.replace(/:id/g, randomUUID()),
  })),
);

const sessions = {} as Record<Role, Session>;
beforeAll(async () => {
  await resetDb();
  for (const role of ROLES) sessions[role] = (await userSession(role)).session;
});

describe('every protected route rejects unauthenticated calls', () => {
  it.each(
    routes
      .filter((r) => r.access !== 'public')
      .map((r) => [r.method.toUpperCase(), r.url, r] as const),
  )('%s %s → 401', async (_m, url, r) => {
    const res = await api()[r.method](url).send({});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });
});

describe('every protected route rejects the wrong role', () => {
  const cases = routes.flatMap((r) =>
    r.access === 'public'
      ? []
      : ROLES.filter((role) => !(r.access as Role[]).includes(role)).map(
          (role) => [r.method.toUpperCase(), r.url, role, r] as const,
        ),
  );
  it.each(cases)('%s %s as %s → 403', async (_m, url, role, r) => {
    const res = await api()[r.method](url).set(sessions[role].auth).send({});
    expect(res.status).toBe(403);
  });
});
