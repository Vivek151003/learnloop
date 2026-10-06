import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { buildOpenApi } from './openapi.js';
import { modules } from './routes/index.js';

const REQUEST_ID = /^[\w-]{8,64}$/;

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Behind nginx / a platform load balancer: trust the first proxy for client IPs.
  app.set('trust proxy', config.TRUST_PROXY);

  // Request IDs on every log line and response (NFR-14).
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id =
          typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      // Probes run every few seconds; logging them would drown real traffic.
      autoLogging: { ignore: (req) => req.url === '/api/v1/health' || req.url === '/api/v1/ready' },
      // Log method, URL and status only, not every header (headers can hold tokens).
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  // Security headers (SEC-7). The API only serves JSON, so the CSP is locked down.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      hsts: { maxAge: 31_536_000, includeSubDomains: true },
      frameguard: { action: 'deny' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  // CORS only for known origins (SEC-7).
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'Retry-After'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(csrfProtection);
  for (const m of modules) api.use(m.basePath || '/', m.router);

  // OpenAPI generated from the Zod schemas; Swagger UI needs a looser CSP.
  const openapi = buildOpenApi(modules);
  app.get('/api/docs/openapi.json', (_req, res) => res.json(openapi));
  app.use(
    '/api/docs',
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
    }),
    swaggerUi.serve,
    swaggerUi.setup(openapi, { customSiteTitle: 'LearnLoop API' }),
  );

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
