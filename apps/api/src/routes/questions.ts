import {
  createQuestionSchema,
  idParamSchema,
  questionQuerySchema,
  updateQuestionStatusSchema,
} from '@learnloop/shared';
import { ApiModule } from '../lib/route.js';
import * as questions from '../services/questions.js';

export const topicsModule = new ApiModule('/topics', 'Topics');
topicsModule.route(
  { method: 'get', path: '/', summary: 'List topics', access: ['student', 'teacher', 'admin'] },
  () => questions.listTopics(),
);

export const questionsModule = new ApiModule('/questions', 'Questions');
questionsModule
  .route(
    {
      method: 'get',
      path: '/',
      summary: 'Search and filter the question bank',
      access: ['teacher', 'admin'],
      query: questionQuerySchema,
    },
    ({ query }) => questions.listQuestions(query),
  )
  .route(
    {
      method: 'post',
      path: '/',
      summary: 'Add a question',
      access: ['teacher'],
      body: createQuestionSchema,
    },
    ({ user, body }) => questions.createQuestion(user, body),
  )
  .route(
    {
      method: 'patch',
      path: '/:id/status',
      summary: 'Approve, retire or return a question to draft',
      access: ['teacher', 'admin'],
      params: idParamSchema,
      body: updateQuestionStatusSchema,
    },
    ({ user, params, body }) => questions.updateQuestionStatus(params.id, user, body.status),
  );
