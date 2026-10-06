import { Redis } from 'ioredis';
import { config } from '../config.js';
import { logger } from './logger.js';

// Redis is optional: without REDIS_URL, rate limits fall back to process memory.
export const redis: Redis | null = config.REDIS_URL
  ? new Redis(config.REDIS_URL, { maxRetriesPerRequest: 2, enableOfflineQueue: false })
  : null;

redis?.on('error', (err) => logger.warn({ err: err.message }, 'redis error'));
