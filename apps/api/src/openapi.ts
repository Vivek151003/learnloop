import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import type { ApiModule } from './lib/route.js';

extendZodWithOpenApi(z);

const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

/** Builds the OpenAPI document from the same Zod schemas the routes validate with. */
export function buildOpenApi(modules: ApiModule[]) {
  const registry = new OpenAPIRegistry();
  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });
  const error = registry.register('Error', errorSchema);

  for (const m of modules) {
    for (const r of m.routes) {
      const path =
        `/api/v1${m.basePath}${r.path === '/' ? '' : r.path}`.replace(/:(\w+)/g, '{$1}') || '/';
      const isPublic = r.access === 'public';
      const errorResponse = (description: string) => ({
        description,
        content: { 'application/json': { schema: error } },
      });
      registry.registerPath({
        method: r.method,
        path,
        tags: [r.tag],
        summary: r.summary,
        description: isPublic ? 'Public' : `Roles: ${(r.access as string[]).join(', ')}`,
        security: isPublic ? [] : [{ bearerAuth: [] }],
        request: {
          ...(r.params ? { params: r.params as z.AnyZodObject } : {}),
          ...(r.query ? { query: r.query as z.AnyZodObject } : {}),
          ...(r.body ? { body: { content: { 'application/json': { schema: r.body } } } } : {}),
        },
        responses: {
          [r.status]: { description: 'Success' },
          400: errorResponse('Validation failed'),
          ...(isPublic
            ? {}
            : {
                401: errorResponse('Not authenticated'),
                403: errorResponse('Wrong role or not the owner'),
              }),
          429: errorResponse('Rate limited'),
        },
      });
    }
  }

  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'LearnLoop API',
      version: '1.0.0',
      description: 'Adaptive learning platform API. Errors use { code, message, requestId }.',
    },
  });
}
