import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { rateLimit } from './rateLimit.js';
import { errorHandler } from './error.js';

describe('rateLimit (SEC-8)', () => {
  it('returns 429 with Retry-After once the limit is used up', async () => {
    const app = express();
    app.post(
      '/login',
      rateLimit({ keyPrefix: 't', points: 2, durationSec: 60, key: () => 'same-ip' }),
      (_req, res) => {
        res.json({ ok: true });
      },
    );
    app.use(errorHandler);

    expect((await request(app).post('/login')).status).toBe(200);
    expect((await request(app).post('/login')).status).toBe(200);
    const blocked = await request(app).post('/login');
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });
});
