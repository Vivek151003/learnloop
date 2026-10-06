import type { AttemptDto, Paginated, Pagination, ProgressDto } from '@learnloop/shared';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/errors.js';
import { toPage, toSkipTake } from '../lib/pagination.js';
import { assertCanViewStudent, type Caller } from './access.js';

const TREND_DAYS = 14;
const DAY_MS = 86_400_000;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Consecutive days with practice, counting back from today (or yesterday). */
export function computeStreak(days: string[], today = new Date()): number {
  const set = new Set(days);
  let cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (!set.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - DAY_MS);
  let streak = 0;
  while (set.has(dayKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

/** FR-15: mastery per topic, streak, accuracy trend and time spent. */
export async function getProgress(studentId: string, caller: Caller): Promise<ProgressDto> {
  await assertCanViewStudent(studentId, caller);
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, displayName: true, role: true },
  });
  if (!student || student.role !== 'student') throw notFound('Student');

  const since = new Date(Date.now() - (TREND_DAYS - 1) * DAY_MS);
  since.setUTCHours(0, 0, 0, 0);

  const [mastery, totals, correct, recent, days] = await Promise.all([
    prisma.mastery.findMany({
      where: { studentId },
      include: { topic: { select: { name: true } } },
      orderBy: { topic: { name: 'asc' } },
    }),
    prisma.attempt.aggregate({
      where: { studentId },
      _count: { _all: true },
      _sum: { timeMs: true },
    }),
    prisma.attempt.count({ where: { studentId, correct: true } }),
    prisma.attempt.findMany({
      where: { studentId, createdAt: { gte: since } },
      select: { createdAt: true, correct: true },
    }),
    // Tagged template: Prisma sends studentId as a bound parameter (SEC-5).
    prisma.$queryRaw<{ d: Date }[]>`
      SELECT DISTINCT date(created_at AT TIME ZONE 'UTC') AS d
      FROM attempts WHERE student_id = ${studentId}::uuid
      ORDER BY d DESC LIMIT 400`,
  ]);

  const byDay = new Map<string, { attempts: number; correct: number }>();
  for (const a of recent) {
    const k = dayKey(a.createdAt);
    const v = byDay.get(k) ?? { attempts: 0, correct: 0 };
    v.attempts++;
    if (a.correct) v.correct++;
    byDay.set(k, v);
  }
  const trend = Array.from({ length: TREND_DAYS }, (_, i) => {
    const date = dayKey(new Date(since.getTime() + i * DAY_MS));
    const v = byDay.get(date);
    return {
      date,
      attempts: v?.attempts ?? 0,
      accuracy: v?.attempts ? Math.round((v.correct / v.attempts) * 1000) / 1000 : 0,
    };
  });

  const total = totals._count._all;
  return {
    studentId,
    displayName: student.displayName,
    mastery: mastery.map((m) => ({
      topicId: m.topicId,
      topicName: m.topic.name,
      score: m.score,
      attempts: m.attempts,
    })),
    streakDays: computeStreak(days.map((r) => dayKey(new Date(r.d)))),
    totalAttempts: total,
    accuracy: total ? Math.round((correct / total) * 1000) / 1000 : 0,
    timeSpentMs: totals._sum.timeMs ?? 0,
    trend,
  };
}

/** FR-24: attempt history with per-question results. */
export async function listAttempts(
  studentId: string,
  caller: Caller,
  p: Pagination,
): Promise<Paginated<AttemptDto>> {
  await assertCanViewStudent(studentId, caller);
  const where = { studentId };
  const [rows, total] = await Promise.all([
    prisma.attempt.findMany({
      where,
      include: { question: { include: { topic: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(p),
    }),
    prisma.attempt.count({ where }),
  ]);
  return toPage(
    rows.map((a) => ({
      id: a.id,
      questionId: a.questionId,
      questionBody: a.question.body,
      topicName: a.question.topic.name,
      answer: a.answer,
      correctAnswer: a.question.correctAnswer,
      correct: a.correct,
      difficulty: a.difficulty,
      timeMs: a.timeMs,
      createdAt: a.createdAt.toISOString(),
    })),
    total,
    p,
  );
}
