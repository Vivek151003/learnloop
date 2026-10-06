import {
  createClassSchema,
  idParamSchema,
  joinClassSchema,
  updateClassSchema,
} from '@learnloop/shared';
import { ApiModule } from '../lib/route.js';
import { authLimiters } from '../middleware/rateLimit.js';
import * as classes from '../services/classes.js';

export const classesModule = new ApiModule('/classes', 'Classes');

classesModule
  .route(
    {
      method: 'get',
      path: '/',
      summary: 'Classes the caller teaches or is enrolled in',
      access: ['student', 'teacher', 'admin'],
    },
    ({ user }) => classes.listClasses(user),
  )
  .route(
    {
      method: 'post',
      path: '/',
      summary: 'Create a class with a join code',
      access: ['teacher'],
      body: createClassSchema,
    },
    ({ user, body }) => classes.createClass(user, body.name),
  )
  .route(
    {
      method: 'post',
      path: '/join',
      summary: 'Join a class with a join code',
      access: ['student'],
      body: joinClassSchema,
      status: 200,
      after: [authLimiters.joinPerUser],
    },
    ({ user, body }) => classes.joinClass(user, body.joinCode),
  )
  .route(
    {
      method: 'patch',
      path: '/:id',
      summary: 'Archive a class or rotate its join code',
      access: ['teacher', 'admin'],
      params: idParamSchema,
      body: updateClassSchema,
    },
    ({ user, params, body }) => classes.updateClass(params.id, user, body),
  )
  .route(
    {
      method: 'get',
      path: '/:id/summary',
      summary: 'Class analytics',
      access: ['teacher', 'admin'],
      params: idParamSchema,
    },
    ({ user, params }) => classes.classSummary(params.id, user),
  )
  .route(
    {
      method: 'get',
      path: '/:id/results.csv',
      summary: 'Export class results as CSV',
      access: ['teacher', 'admin'],
      params: idParamSchema,
    },
    async ({ user, params, res }) => {
      const csv = await classes.classResultsCsv(params.id, user);
      res.status(200).type('text/csv').attachment(`class-${params.id}-results.csv`).send(csv);
    },
  );
