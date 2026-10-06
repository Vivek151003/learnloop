import { idParamSchema, paginationSchema } from '@learnloop/shared';
import { ApiModule } from '../lib/route.js';
import * as progress from '../services/progress.js';

export const studentsModule = new ApiModule('/students', 'Students');
studentsModule
  .route(
    {
      method: 'get',
      path: '/:id/progress',
      summary: 'Progress and mastery',
      access: ['student', 'teacher', 'admin'],
      params: idParamSchema,
    },
    ({ user, params }) => progress.getProgress(params.id, user),
  )
  .route(
    {
      method: 'get',
      path: '/:id/attempts',
      summary: 'Attempt history',
      access: ['student', 'teacher', 'admin'],
      params: idParamSchema,
      query: paginationSchema,
    },
    ({ user, params, query }) => progress.listAttempts(params.id, user, query),
  );
