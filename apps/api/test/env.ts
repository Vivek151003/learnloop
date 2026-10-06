// Test environment, applied before any app module reads config.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://learnloop:learnloop@localhost:5432/learnloop_test';

export function applyTestEnv() {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    JWT_SECRET: 'test-secret-that-is-long-enough-for-hs256-0123456789',
    AUTH_RATE_LIMIT_POINTS: '10000',
    COOKIE_SECURE: 'false',
    AI_PROVIDER: 'mock',
  });
  delete process.env.REDIS_URL;
}
