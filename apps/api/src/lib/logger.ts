import pino from 'pino';
import { config } from '../config.js';

// Structured JSON logs (NFR-14). Secrets and credentials are redacted (SEC-9, AI-23).
export const logger = pino({
  level: config.LOG_LEVEL ?? (config.isTest ? 'silent' : config.isProd ? 'info' : 'debug'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-csrf-token"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
    ],
    censor: '[redacted]',
  },
  ...(config.isProd || config.isTest
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true, singleLine: true } } }),
});
