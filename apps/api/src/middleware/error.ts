import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import type { ApiError } from '@learnloop/shared';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const requestId = (req: Request) => String(req.id ?? 'unknown');

/**
 * One error shape for every failure: { code, message, requestId } (API conventions).
 * Stack traces, SQL and internal messages never reach the client (SEC-13).
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const send = (status: number, body: Omit<ApiError, 'requestId'>) =>
    res.status(status).json({ ...body, requestId: requestId(req) } satisfies ApiError);

  if (err instanceof AppError) {
    return send(err.status, { code: err.code, message: err.message, details: err.details });
  }
  if (err instanceof ZodError) {
    return send(400, {
      code: 'VALIDATION_ERROR',
      message: 'The request is invalid',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return send(409, { code: 'CONFLICT', message: 'Already exists' });
    if (err.code === 'P2025') return send(404, { code: 'NOT_FOUND', message: 'Not found' });
  }
  // Errors raised by body-parser for bad JSON or oversized bodies.
  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.parse.failed') {
    return send(400, { code: 'INVALID_JSON', message: 'Request body is not valid JSON' });
  }
  if (type === 'entity.too.large') {
    return send(413, { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' });
  }

  logger.error({ err, requestId: requestId(req) }, 'unhandled error');
  return send(500, { code: 'INTERNAL', message: 'Something went wrong' });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: 'Route not found',
    requestId: requestId(req),
  } satisfies ApiError);
}
