import { z } from 'zod';

// All configuration comes from the environment and is validated once at boot,
// so a missing or weak secret stops the process instead of failing later (SEC-9).

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().min(60).max(900).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  COOKIE_SECURE: bool.optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  AUTH_RATE_LIMIT_POINTS: z.coerce.number().int().min(1).default(20),
  AUTH_RATE_LIMIT_WINDOW_SEC: z.coerce
    .number()
    .int()
    .min(1)
    .default(15 * 60),
  AI_PROVIDER: z.enum(['mock', 'gemini', 'ollama']).default('mock'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('llama3.2'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(15_000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(50).max(4000).default(600),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    // Names only, never values, so secrets are not echoed.
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }
  const env = parsed.data;
  if (env.AI_PROVIDER === 'gemini' && !env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required when AI_PROVIDER=gemini');
  }
  const isProd = env.NODE_ENV === 'production';
  return {
    ...env,
    isProd,
    isTest: env.NODE_ENV === 'test',
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    cookieSecure: env.COOKIE_SECURE ?? isProd,
  };
}

export const config = loadConfig();
export type Config = typeof config;
