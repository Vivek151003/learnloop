import type {
  AssignQuizInput,
  AssignmentDto,
  CreateQuizInput,
  QuestionDto,
  QuizDto,
} from '@learnloop/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError, badRequest, notFound } from '../lib/errors.js';
import { assertClassOwner, assertQuizOwner, type Caller } from './access.js';
import { recordAudit } from './audit.js';
import { toQuestionDto } from './questions.js';

const quizInclude = {
  topic: { select: { name: true } },
  _count: { select: { questions: true } },
} satisfies Prisma.QuizInclude;

function toQuizDto(q: Prisma.QuizGetPayload<{ include: typeof quizInclude }>): QuizDto {
  return {
    id: q.id,
    title: q.title,
    topicId: q.topicId,
    topicName: q.topic.name,
    status: q.status,
    questionCount: q._count.questions,
    createdAt: q.createdAt.toISOString(),
  };
}

export async function listQuizzes(caller: Caller): Promise<QuizDto[]> {
  const rows = await prisma.quiz.findMany({
    where: caller.role === 'admin' ? {} : { ownerId: caller.id },
    include: quizInclude,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toQuizDto);
}

export async function getQuiz(
  id: string,
  caller: Caller,
): Promise<QuizDto & { questions: QuestionDto[] }> {
  await assertQuizOwner(id, caller);
  const quiz = await prisma.quiz.findUniqueOrThrow({
    where: { id },
    include: {
      ...quizInclude,
      questions: {
        orderBy: { position: 'asc' },
        include: { question: { include: { topic: { select: { name: true } } } } },
      },
    },
  });
  return { ...toQuizDto(quiz), questions: quiz.questions.map((qq) => toQuestionDto(qq.question)) };
}

/**
 * FR-21 (manual path): a quiz built from approved questions in the question bank
 * is published straight away. AI drafts in Week 3 go through review first.
 */
export async function createQuiz(caller: Caller, input: CreateQuizInput): Promise<QuizDto> {
  const questions = await prisma.question.findMany({
    where: { id: { in: input.questionIds } },
    select: { id: true, status: true },
  });
  if (questions.length !== input.questionIds.length) throw notFound('One or more questions');
  if (questions.some((q) => q.status !== 'approved')) {
    throw badRequest('Only approved questions can be added to a quiz', 'QUESTION_NOT_APPROVED');
  }
  const topic = await prisma.topic.findUnique({ where: { id: input.topicId } });
  if (!topic) throw notFound('Topic');

  const quiz = await prisma.quiz.create({
    data: {
      title: input.title,
      topicId: input.topicId,
      ownerId: caller.id,
      status: 'published',
      questions: {
        create: input.questionIds.map((questionId, position) => ({ questionId, position })),
      },
    },
    include: quizInclude,
  });
  await recordAudit({
    actorId: caller.id,
    action: 'quiz.created',
    target: `quiz:${quiz.id}`,
    metadata: { questionCount: input.questionIds.length },
  });
  return toQuizDto(quiz);
}

/** FR-22: assign to a whole class or to selected students in it. */
export async function assignQuiz(
  quizId: string,
  caller: Caller,
  input: AssignQuizInput,
): Promise<{ assignmentId: string; studentCount: number }> {
  const quiz = await assertQuizOwner(quizId, caller);
  if (quiz.status !== 'published') throw badRequest('Only published quizzes can be assigned');
  const cls = await assertClassOwner(input.classId, caller);
  if (cls.archived) throw badRequest('This class is archived', 'CLASS_ARCHIVED');
  if (input.dueAt <= new Date()) throw badRequest('Due date must be in the future', 'DUE_IN_PAST');

  const enrolled = await prisma.enrollment.findMany({
    where: { classId: cls.id },
    select: { studentId: true },
  });
  const enrolledIds = new Set(enrolled.map((e) => e.studentId));
  let targets = [...enrolledIds];
  if (input.studentIds) {
    const outsiders = input.studentIds.filter((id) => !enrolledIds.has(id));
    if (outsiders.length) {
      throw new AppError(400, 'NOT_ENROLLED', 'Some students are not in this class');
    }
    targets = [...new Set(input.studentIds)];
  }

  const assignment = await prisma.assignment.create({
    data: {
      quizId,
      classId: cls.id,
      dueAt: input.dueAt,
      wholeClass: !input.studentIds,
      targets: { create: targets.map((studentId) => ({ studentId })) },
    },
  });
  await recordAudit({
    actorId: caller.id,
    action: 'assignment.created',
    target: `assignment:${assignment.id}`,
    metadata: {
      quizId,
      classId: cls.id,
      studentCount: targets.length,
      dueAt: input.dueAt.toISOString(),
    },
  });
  return { assignmentId: assignment.id, studentCount: targets.length };
}

/** FR-17: a student's assigned work, with overdue flags. */
export async function listAssignments(caller: Caller): Promise<AssignmentDto[]> {
  const now = new Date();
  if (caller.role === 'student') {
    const targets = await prisma.assignmentTarget.findMany({
      where: { studentId: caller.id, assignment: { class: { archived: false } } },
      include: {
        assignment: {
          include: {
            class: { select: { name: true } },
            quiz: { include: quizInclude },
          },
        },
      },
      orderBy: { assignment: { dueAt: 'asc' } },
    });
    return targets.map((t) => ({
      id: t.assignment.id,
      quizId: t.assignment.quizId,
      quizTitle: t.assignment.quiz.title,
      topicName: t.assignment.quiz.topic.name,
      classId: t.assignment.classId,
      className: t.assignment.class.name,
      dueAt: t.assignment.dueAt.toISOString(),
      questionCount: t.assignment.quiz._count.questions,
      completed: Boolean(t.completedAt),
      overdue: !t.completedAt && t.assignment.dueAt < now,
    }));
  }

  const assignments = await prisma.assignment.findMany({
    where: caller.role === 'admin' ? {} : { class: { teacherId: caller.id } },
    include: {
      class: { select: { name: true } },
      quiz: { include: quizInclude },
      targets: { select: { completedAt: true } },
    },
    orderBy: { dueAt: 'desc' },
    take: 100,
  });
  return assignments.map((a) => {
    const allDone = a.targets.length > 0 && a.targets.every((t) => t.completedAt);
    return {
      id: a.id,
      quizId: a.quizId,
      quizTitle: a.quiz.title,
      topicName: a.quiz.topic.name,
      classId: a.classId,
      className: a.class.name,
      dueAt: a.dueAt.toISOString(),
      questionCount: a.quiz._count.questions,
      completed: allDone,
      overdue: !allDone && a.dueAt < now,
    };
  });
}
