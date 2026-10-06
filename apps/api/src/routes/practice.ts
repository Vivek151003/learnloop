import { idParamSchema, startSessionSchema, submitAnswerSchema } from '@learnloop/shared';
import { ApiModule } from '../lib/route.js';
import * as practice from '../services/practice.js';

export const practiceModule = new ApiModule('/practice', 'Practice');
practiceModule
  .route(
    { method: 'get', path: '/sessions', summary: 'Recent practice sessions', access: ['student'] },
    ({ user }) => practice.listSessions(user),
  )
  .route(
    {
      method: 'post',
      path: '/sessions',
      summary: 'Start or resume a practice session',
      access: ['student'],
      body: startSessionSchema,
    },
    ({ user, body }) => practice.startSession(user, body),
  )
  .route(
    {
      method: 'get',
      path: '/sessions/:id/next',
      summary: 'The current question in a session',
      access: ['student'],
      params: idParamSchema,
    },
    ({ user, params }) => practice.nextQuestion(params.id, user),
  )
  .route(
    {
      method: 'post',
      path: '/sessions/:id/answer',
      summary: 'Answer the current question',
      access: ['student'],
      params: idParamSchema,
      body: submitAnswerSchema,
      status: 200,
    },
    ({ user, params, body }) => practice.submitAnswer(params.id, user, body),
  );
