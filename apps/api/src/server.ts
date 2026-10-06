import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';

const server = createApp().listen(config.PORT, () => {
  logger.info(
    { port: config.PORT, env: config.NODE_ENV, ai: config.AI_PROVIDER },
    'LearnLoop API listening',
  );
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close();
  await prisma.$disconnect();
  redis?.disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
