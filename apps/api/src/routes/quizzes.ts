import { assignQuizSchema, createQuizSchema, idParamSchema } from '@learnloop/shared';
import { ApiModule } from '../lib/route.js';
import * as quizzes from '../services/quizzes.js';

export const quizzesModule = new ApiModule('/quizzes', 'Quizzes');
quizzesModule
  .route(
    { method: 'get', path: '/', summary: "The caller's quizzes", access: ['teacher', 'admin'] },
    ({ user }) => quizzes.listQuizzes(user),
  )
  .route(
    {
      method: 'post',
      path: '/',
      summary: 'Create a quiz from approved questions',
      access: ['teacher'],
      body: createQuizSchema,
    },
    ({ user, body }) => quizzes.createQuiz(user, body),
  )
  .route(
    {
      method: 'get',
      path: '/:id',
      summary: 'A quiz with its questions',
      access: ['teacher', 'admin'],
      params: idParamSchema,
    },
    ({ user, params }) => quizzes.getQuiz(params.id, user),
  )
  .route(
    {
      method: 'post',
      path: '/:id/assign',
      summary: 'Assign a quiz to a class or selected students',
      access: ['teacher'],
      params: idParamSchema,
      body: assignQuizSchema,
    },
    ({ user, params, body }) => quizzes.assignQuiz(params.id, user, body),
  );

export const assignmentsModule = new ApiModule('/assignments', 'Assignments');
assignmentsModule.route(
  {
    method: 'get',
    path: '/',
    summary: 'Assigned work: own (student) or set (teacher)',
    access: ['student', 'teacher', 'admin'],
  },
  ({ user }) => quizzes.listAssignments(user),
);
