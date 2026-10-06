import { ApiModule } from '../lib/route.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { AppError } from '../lib/errors.js';

export const healthModule = new ApiModule('', 'Health');
healthModule
  .route(
    { method: 'get', path: '/health', summary: 'Liveness probe', access: 'public' },
    async () => ({
      status: 'ok',
    }),
  )
  .route(
    { method: 'get', path: '/ready', summary: 'Readiness probe', access: 'public' },
    async () => {
      const checks: Record<string, 'ok' | 'fail' | 'skipped'> = {
        database: 'ok',
        redis: 'skipped',
      };
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch {
        checks.database = 'fail';
      }
      if (redis) {
        try {
          await redis.ping();
          checks.redis = 'ok';
        } catch {
          checks.redis = 'fail';
        }
      }
      if (Object.values(checks).includes('fail')) {
        throw new AppError(503, 'NOT_READY', `Not ready: ${JSON.stringify(checks)}`);
      }
      return { status: 'ready', checks };
    },
  );
