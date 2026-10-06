import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import type { Role } from '@learnloop/shared';
import { authenticate, requireRole } from '../middleware/auth.js';
import { unauthorized } from './errors.js';

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

export interface RouteSpec<
  B extends ZodTypeAny | undefined,
  P extends ZodTypeAny | undefined,
  Q extends ZodTypeAny | undefined,
> {
  method: Method;
  path: string;
  summary: string;
  /** 'public' skips authentication; otherwise the roles allowed to call the route. */
  access: 'public' | Role[];
  body?: B;
  params?: P;
  query?: Q;
  /** Success status code; a handler that returns undefined responds 204. */
  status?: number;
  /** Middleware that runs before authentication, such as rate limiters. */
  before?: RequestHandler[];
  /** Middleware that runs after authentication. */
  after?: RequestHandler[];
}

type Parsed<S> = S extends ZodTypeAny ? z.infer<S> : undefined;

export interface Ctx<B, P, Q> {
  body: B;
  params: P;
  query: Q;
  /** The authenticated caller. Throws on public routes with no caller. */
  readonly user: { id: string; role: Role };
  req: Request;
  res: Response;
}

export interface RegisteredRoute {
  method: Method;
  path: string;
  summary: string;
  tag: string;
  access: 'public' | Role[];
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  status: number;
}

/**
 * A group of routes under one base path. Each route declares its access rule and
 * Zod schemas once; the same declaration drives authentication, role checks,
 * validation (SEC-4) and the generated OpenAPI document.
 */
export class ApiModule {
  readonly router = Router();
  readonly routes: RegisteredRoute[] = [];

  constructor(
    readonly basePath: string,
    readonly tag: string,
  ) {}

  route<
    B extends ZodTypeAny | undefined = undefined,
    P extends ZodTypeAny | undefined = undefined,
    Q extends ZodTypeAny | undefined = undefined,
  >(
    spec: RouteSpec<B, P, Q>,
    handler: (ctx: Ctx<Parsed<B>, Parsed<P>, Parsed<Q>>) => Promise<unknown>,
  ) {
    const status = spec.status ?? (spec.method === 'post' ? 201 : 200);
    this.routes.push({ ...spec, tag: this.tag, status });

    const chain: RequestHandler[] = [...(spec.before ?? [])];
    if (spec.access !== 'public') chain.push(authenticate, requireRole(...spec.access));
    chain.push(...(spec.after ?? []));

    chain.push(async (req, res, next) => {
      try {
        const ctx = {
          body: spec.body ? spec.body.parse(req.body ?? {}) : undefined,
          params: spec.params ? spec.params.parse(req.params) : undefined,
          query: spec.query ? spec.query.parse(req.query) : undefined,
          get user() {
            if (!req.user) throw unauthorized();
            return req.user;
          },
          req,
          res,
        } as Ctx<Parsed<B>, Parsed<P>, Parsed<Q>>;
        const result = await handler(ctx);
        if (res.headersSent) return;
        if (result === undefined) res.status(204).end();
        else res.status(status).json(result);
      } catch (err) {
        next(err);
      }
    });

    this.router[spec.method](spec.path, ...chain);
    return this;
  }
}
