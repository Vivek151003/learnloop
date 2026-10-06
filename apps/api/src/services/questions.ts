import type { Prisma, Question, Topic } from '@prisma/client';
import type {
  CreateQuestionInput,
  Paginated,
  QuestionDto,
  QuestionQuery,
  QuestionStatus,
  TopicDto,
} from '@learnloop/shared';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/errors.js';
import { toPage, toSkipTake } from '../lib/pagination.js';
import type { Caller } from './access.js';
import { recordAudit } from './audit.js';

export function toQuestionDto(q: Question & { topic: Pick<Topic, 'name'> }): QuestionDto {
  return {
    id: q.id,
    topicId: q.topicId,
    topicName: q.topic.name,
    difficulty: q.difficulty,
    type: q.type,
    body: q.body,
    options: Array.isArray(q.options) ? (q.options as string[]) : null,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    status: q.status,
    source: q.source,
  };
}

export async function listTopics(): Promise<TopicDto[]> {
  return prisma.topic.findMany({
    orderBy: [{ gradeLevel: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, gradeLevel: true },
  });
}

/** FR-32: search and filter the question bank. */
export async function listQuestions(q: QuestionQuery): Promise<Paginated<QuestionDto>> {
  const where: Prisma.QuestionWhereInput = {
    ...(q.topicId ? { topicId: q.topicId } : {}),
    ...(q.difficulty ? { difficulty: q.difficulty } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.q ? { body: { contains: q.q, mode: 'insensitive' } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: { topic: { select: { name: true } } },
      orderBy: [{ status: 'asc' }, { difficulty: 'asc' }, { createdAt: 'desc' }],
      ...toSkipTake(q),
    }),
    prisma.question.count({ where }),
  ]);
  return toPage(rows.map(toQuestionDto), total, q);
}

/**
 * Teacher-written questions are approved on creation. AI-generated questions
 * (Week 3) are created with status "draft" and need approval (FR-31).
 */
export async function createQuestion(
  caller: Caller,
  input: CreateQuestionInput,
): Promise<QuestionDto> {
  const topic = await prisma.topic.findUnique({ where: { id: input.topicId } });
  if (!topic) throw notFound('Topic');
  const q = await prisma.question.create({
    data: {
      topicId: input.topicId,
      difficulty: input.difficulty,
      type: input.type,
      body: input.body,
      options: input.type === 'multiple_choice' ? input.options : undefined,
      correctAnswer: input.correctAnswer,
      explanation: input.explanation,
      status: 'approved',
      source: 'human',
      createdById: caller.id,
    },
    include: { topic: { select: { name: true } } },
  });
  await recordAudit({ actorId: caller.id, action: 'question.created', target: `question:${q.id}` });
  return toQuestionDto(q);
}

export async function updateQuestionStatus(
  id: string,
  caller: Caller,
  status: QuestionStatus,
): Promise<QuestionDto> {
  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing) throw notFound('Question');
  const q = await prisma.question.update({
    where: { id },
    data: { status },
    include: { topic: { select: { name: true } } },
  });
  await recordAudit({
    actorId: caller.id,
    action: 'question.status_changed',
    target: `question:${id}`,
    metadata: { from: existing.status, to: status },
  });
  return toQuestionDto(q);
}
