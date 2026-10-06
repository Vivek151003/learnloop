import type { PracticeSession, Question, Topic } from '@prisma/client';
import type {
  AnswerResult,
  NextQuestionResponse,
  PracticeQuestionDto,
  PracticeSessionDto,
  StartSessionInput,
  SubmitAnswerInput,
} from '@learnloop/shared';
import { prisma } from '../lib/prisma.js';
import { AppError, conflict, forbidden, notFound } from '../lib/errors.js';
import type { Caller } from './access.js';
import { isAnswerCorrect, nextDifficulty, startingDifficulty, updateMastery } from './adaptive.js';

export const TOPIC_SESSION_LENGTH = 10;

type SessionRow = PracticeSession & { topic: Pick<Topic, 'name'> };

function toSessionDto(s: SessionRow): PracticeSessionDto {
  return {
    id: s.id,
    topicId: s.topicId,
    topicName: s.topic.name,
    assignmentId: s.assignmentId,
    currentDifficulty: s.currentDifficulty,
    answeredCount: s.answeredCount,
    correctCount: s.correctCount,
    totalQuestions: s.totalQuestions,
    completed: Boolean(s.completedAt),
    startedAt: s.startedAt.toISOString(),
  };
}

/** The student-facing question never includes the answer or explanation. */
function toPracticeQuestion(q: Question & { topic: Pick<Topic, 'name'> }): PracticeQuestionDto {
  return {
    id: q.id,
    topicName: q.topic.name,
    difficulty: q.difficulty,
    type: q.type,
    body: q.body,
    options: Array.isArray(q.options) ? (q.options as string[]) : null,
  };
}

const withTopic = { topic: { select: { name: true } } } as const;

async function loadOwnSession(sessionId: string, caller: Caller): Promise<SessionRow> {
  const session = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    include: withTopic,
  });
  if (!session) throw notFound('Session');
  if (session.studentId !== caller.id) throw forbidden();
  return session;
}

/**
 * FR-11, FR-16, FR-17: start practice by topic or for an assignment. If an
 * unfinished session for the same work exists, it is resumed instead.
 */
export async function startSession(
  caller: Caller,
  input: StartSessionInput,
): Promise<{ session: PracticeSessionDto; resumed: boolean }> {
  if (input.assignmentId) {
    const target = await prisma.assignmentTarget.findUnique({
      where: { assignmentId_studentId: { assignmentId: input.assignmentId, studentId: caller.id } },
      include: {
        assignment: {
          include: {
            quiz: {
              include: {
                questions: { orderBy: { position: 'asc' }, take: 1, include: { question: true } },
                _count: { select: { questions: true } },
              },
            },
          },
        },
      },
    });
    if (!target) throw notFound('Assignment');
    if (target.completedAt)
      throw conflict('You have already completed this assignment', 'ALREADY_COMPLETED');

    const existing = await prisma.practiceSession.findFirst({
      where: { studentId: caller.id, assignmentId: input.assignmentId, completedAt: null },
      include: withTopic,
    });
    if (existing) return { session: toSessionDto(existing), resumed: true };

    const quiz = target.assignment.quiz;
    const created = await prisma.practiceSession.create({
      data: {
        studentId: caller.id,
        topicId: quiz.topicId,
        assignmentId: input.assignmentId,
        currentDifficulty: quiz.questions[0]?.question.difficulty ?? 1,
        totalQuestions: quiz._count.questions,
      },
      include: withTopic,
    });
    return { session: toSessionDto(created), resumed: false };
  }

  const topicId = input.topicId!;
  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic) throw notFound('Topic');

  const existing = await prisma.practiceSession.findFirst({
    where: { studentId: caller.id, topicId, assignmentId: null, completedAt: null },
    include: withTopic,
    orderBy: { startedAt: 'desc' },
  });
  if (existing) return { session: toSessionDto(existing), resumed: true };

  const mastery = await prisma.mastery.findUnique({
    where: { studentId_topicId: { studentId: caller.id, topicId } },
  });
  const created = await prisma.practiceSession.create({
    data: {
      studentId: caller.id,
      topicId,
      currentDifficulty: startingDifficulty(mastery?.score),
      totalQuestions: TOPIC_SESSION_LENGTH,
    },
    include: withTopic,
  });
  return { session: toSessionDto(created), resumed: false };
}

export async function listSessions(caller: Caller): Promise<PracticeSessionDto[]> {
  const rows = await prisma.practiceSession.findMany({
    where: { studentId: caller.id },
    include: withTopic,
    orderBy: { startedAt: 'desc' },
    take: 20,
  });
  return rows.map(toSessionDto);
}

/**
 * Picks an approved question in the topic at the target difficulty that the
 * student has not seen in this session, widening the difficulty if needed.
 */
async function pickAdaptiveQuestion(session: PracticeSession): Promise<string | null> {
  const seen = await prisma.attempt.findMany({
    where: { sessionId: session.id },
    select: { questionId: true },
  });
  const exclude = seen.map((a) => a.questionId);
  for (const spread of [0, 1, 2, 4]) {
    const where = {
      topicId: session.topicId,
      status: 'approved' as const,
      id: { notIn: exclude },
      difficulty: {
        gte: session.currentDifficulty - spread,
        lte: session.currentDifficulty + spread,
      },
    };
    const count = await prisma.question.count({ where });
    if (count === 0) continue;
    const [pick] = await prisma.question.findMany({
      where,
      select: { id: true },
      orderBy: { id: 'asc' },
      skip: Math.floor(Math.random() * count),
      take: 1,
    });
    if (pick) return pick.id;
  }
  return null;
}

async function pickAssignmentQuestion(session: PracticeSession): Promise<string | null> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: session.assignmentId! },
    select: { quizId: true },
  });
  if (!assignment) return null;
  const qq = await prisma.quizQuestion.findFirst({
    where: { quizId: assignment.quizId },
    orderBy: { position: 'asc' },
    skip: session.answeredCount,
    select: { questionId: true },
  });
  return qq?.questionId ?? null;
}

/**
 * FR-11: questions are served one at a time. The pending question is stored on
 * the session, so calling this again (or after closing the browser) returns the
 * same question rather than a new one (FR-16).
 */
export async function nextQuestion(
  sessionId: string,
  caller: Caller,
): Promise<NextQuestionResponse> {
  let session = await loadOwnSession(sessionId, caller);
  if (session.completedAt) return { session: toSessionDto(session), question: null };

  if (!session.currentQuestionId) {
    const questionId = session.assignmentId
      ? await pickAssignmentQuestion(session)
      : await pickAdaptiveQuestion(session);
    if (!questionId) {
      // No more questions available: close the session rather than stall.
      session = await prisma.practiceSession.update({
        where: { id: session.id },
        data: { completedAt: new Date() },
        include: withTopic,
      });
      return { session: toSessionDto(session), question: null };
    }
    // Only set if still empty, so two tabs cannot each get a different question.
    await prisma.practiceSession.updateMany({
      where: { id: session.id, currentQuestionId: null },
      data: { currentQuestionId: questionId },
    });
    session = await loadOwnSession(sessionId, caller);
  }

  const question = await prisma.question.findUniqueOrThrow({
    where: { id: session.currentQuestionId! },
    include: withTopic,
  });
  return { session: toSessionDto(session), question: toPracticeQuestion(question) };
}

/** FR-12, FR-13: check the answer on the server, adapt difficulty, update mastery. */
export async function submitAnswer(
  sessionId: string,
  caller: Caller,
  input: SubmitAnswerInput,
): Promise<AnswerResult> {
  const session = await loadOwnSession(sessionId, caller);
  if (session.completedAt) throw conflict('This session is already complete', 'SESSION_COMPLETE');
  if (session.currentQuestionId !== input.questionId) {
    throw new AppError(409, 'QUESTION_MISMATCH', 'That is not the current question');
  }
  const question = await prisma.question.findUniqueOrThrow({ where: { id: input.questionId } });
  const correct = isAnswerCorrect(question.type, question.correctAnswer, input.answer);

  // Assignments are fixed quizzes; only free practice adapts difficulty.
  const adapted = session.assignmentId
    ? { difficulty: session.currentDifficulty, streak: session.streak }
    : nextDifficulty({ difficulty: session.currentDifficulty, streak: session.streak }, correct);

  const answeredCount = session.answeredCount + 1;
  const finished = answeredCount >= session.totalQuestions;
  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    // Conditional update: a double-submit of the same question changes nothing.
    const claimed = await tx.practiceSession.updateMany({
      where: { id: session.id, currentQuestionId: input.questionId, completedAt: null },
      data: {
        currentQuestionId: null,
        answeredCount: { increment: 1 },
        correctCount: { increment: correct ? 1 : 0 },
        currentDifficulty: adapted.difficulty,
        streak: adapted.streak,
        completedAt: finished ? now : null,
      },
    });
    if (claimed.count === 0)
      throw new AppError(409, 'ALREADY_ANSWERED', 'This question was already answered');

    await tx.attempt.create({
      data: {
        studentId: caller.id,
        questionId: question.id,
        sessionId: session.id,
        answer: input.answer,
        correct,
        difficulty: question.difficulty,
        timeMs: input.timeMs,
      },
    });

    const mastery = await tx.mastery.findUnique({
      where: { studentId_topicId: { studentId: caller.id, topicId: question.topicId } },
    });
    const score = updateMastery(mastery?.score ?? 0, mastery?.attempts ?? 0, correct);
    await tx.mastery.upsert({
      where: { studentId_topicId: { studentId: caller.id, topicId: question.topicId } },
      create: { studentId: caller.id, topicId: question.topicId, score, attempts: 1 },
      update: { score, attempts: { increment: 1 } },
    });

    if (finished && session.assignmentId) {
      await tx.assignmentTarget.updateMany({
        where: { assignmentId: session.assignmentId, studentId: caller.id, completedAt: null },
        data: { completedAt: now },
      });
    }
    return tx.practiceSession.findUniqueOrThrow({ where: { id: session.id }, include: withTopic });
  });

  return {
    correct,
    correctAnswer: question.correctAnswer,
    // Static explanation is the graceful fallback (NFR-10); AI explanations arrive in Week 3.
    explanation: question.explanation,
    explanationSource: 'static',
    previousDifficulty: session.currentDifficulty,
    newDifficulty: updated.currentDifficulty,
    session: toSessionDto(updated),
  };
}
