import { Prisma } from '@prisma/client';
import type { ClassDto, ClassSummaryDto } from '@learnloop/shared';
import { prisma } from '../lib/prisma.js';
import { randomJoinCode } from '../lib/crypto.js';
import { AppError, notFound } from '../lib/errors.js';
import { assertClassOwner, type Caller } from './access.js';
import { recordAudit } from './audit.js';

const AT_RISK_ACCURACY = 0.5;
const AT_RISK_MIN_ATTEMPTS = 5;

const classInclude = {
  teacher: { select: { displayName: true } },
  _count: { select: { enrollments: true } },
} satisfies Prisma.ClassInclude;

type ClassRow = Prisma.ClassGetPayload<{ include: typeof classInclude }>;

function toClassDto(c: ClassRow, caller: Caller): ClassDto {
  const canSeeCode = caller.role === 'admin' || c.teacherId === caller.id;
  return {
    id: c.id,
    name: c.name,
    joinCode: canSeeCode ? c.joinCode : null,
    archived: c.archived,
    teacherName: c.teacher.displayName,
    studentCount: c._count.enrollments,
    createdAt: c.createdAt.toISOString(),
  };
}

export async function listClasses(caller: Caller): Promise<ClassDto[]> {
  const where: Prisma.ClassWhereInput =
    caller.role === 'teacher'
      ? { teacherId: caller.id }
      : caller.role === 'student'
        ? { enrollments: { some: { studentId: caller.id } }, archived: false }
        : {};
  const rows = await prisma.class.findMany({
    where,
    include: classInclude,
    orderBy: [{ archived: 'asc' }, { createdAt: 'desc' }],
  });
  return rows.map((c) => toClassDto(c, caller));
}

/** Join codes are random; on the rare collision, try again with a new one. */
async function withUniqueJoinCode<T>(fn: (code: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fn(randomJoinCode());
    } catch (err) {
      const collided = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!collided) throw err;
    }
  }
  throw new AppError(500, 'JOIN_CODE_EXHAUSTED', 'Could not generate a join code');
}

export async function createClass(caller: Caller, name: string): Promise<ClassDto> {
  const cls = await withUniqueJoinCode((joinCode) =>
    prisma.class.create({ data: { name, teacherId: caller.id, joinCode }, include: classInclude }),
  );
  await recordAudit({ actorId: caller.id, action: 'class.created', target: `class:${cls.id}` });
  return toClassDto(cls, caller);
}

export async function updateClass(
  classId: string,
  caller: Caller,
  input: { archived?: boolean; rotateJoinCode?: true },
): Promise<ClassDto> {
  await assertClassOwner(classId, caller);
  let updated: ClassRow;
  if (input.rotateJoinCode) {
    updated = await withUniqueJoinCode((joinCode) =>
      prisma.class.update({
        where: { id: classId },
        data: { joinCode, ...(input.archived !== undefined ? { archived: input.archived } : {}) },
        include: classInclude,
      }),
    );
    await recordAudit({
      actorId: caller.id,
      action: 'class.join_code_rotated',
      target: `class:${classId}`,
    });
  } else {
    updated = await prisma.class.update({
      where: { id: classId },
      data: { archived: input.archived },
      include: classInclude,
    });
  }
  if (input.archived !== undefined) {
    await recordAudit({
      actorId: caller.id,
      action: 'class.archived',
      target: `class:${classId}`,
      metadata: { archived: input.archived },
    });
  }
  return toClassDto(updated, caller);
}

/** FR-10: a student joins with a code. An unknown or archived class looks the same. */
export async function joinClass(caller: Caller, joinCode: string): Promise<ClassDto> {
  const cls = await prisma.class.findUnique({ where: { joinCode } });
  if (!cls || cls.archived) throw notFound('Class with that join code');
  await prisma.enrollment.upsert({
    where: { classId_studentId: { classId: cls.id, studentId: caller.id } },
    create: { classId: cls.id, studentId: caller.id },
    update: {},
  });
  // A student who joins late still receives work already assigned to the whole class.
  const classWide = await prisma.assignment.findMany({
    where: { classId: cls.id, wholeClass: true, dueAt: { gt: new Date() } },
    select: { id: true },
  });
  if (classWide.length > 0) {
    await prisma.assignmentTarget.createMany({
      data: classWide.map((a) => ({ assignmentId: a.id, studentId: caller.id })),
      skipDuplicates: true,
    });
  }
  const full = await prisma.class.findUniqueOrThrow({
    where: { id: cls.id },
    include: classInclude,
  });
  return toClassDto(full, caller);
}

/** FR-23: the class dashboard numbers. */
export async function classSummary(classId: string, caller: Caller): Promise<ClassSummaryDto> {
  const cls = await assertClassOwner(classId, caller);
  const now = new Date();

  const enrollments = await prisma.enrollment.findMany({
    where: { classId },
    include: { student: { select: { id: true, displayName: true } } },
    orderBy: { student: { displayName: 'asc' } },
  });
  const studentIds = enrollments.map((e) => e.studentId);

  const [attemptStats, correctStats, assignments, overdue, weakest] = await Promise.all([
    prisma.attempt.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds } },
      _count: { _all: true },
    }),
    prisma.attempt.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds }, correct: true },
      _count: { _all: true },
    }),
    prisma.assignment.findMany({
      where: { classId },
      include: {
        quiz: { select: { title: true } },
        targets: { select: { completedAt: true } },
      },
      orderBy: { dueAt: 'desc' },
    }),
    prisma.assignmentTarget.groupBy({
      by: ['studentId'],
      where: {
        studentId: { in: studentIds },
        completedAt: null,
        assignment: { classId, dueAt: { lt: now } },
      },
      _count: { _all: true },
    }),
    prisma.mastery.groupBy({
      by: ['topicId'],
      where: { studentId: { in: studentIds } },
      _avg: { score: true },
      orderBy: { _avg: { score: 'asc' } },
      take: 3,
    }),
  ]);

  const attemptsBy = new Map(attemptStats.map((s) => [s.studentId, s._count._all]));
  const correctBy = new Map(correctStats.map((s) => [s.studentId, s._count._all]));
  const overdueBy = new Map(overdue.map((s) => [s.studentId, s._count._all]));

  const students = enrollments.map((e) => {
    const attempts = attemptsBy.get(e.studentId) ?? 0;
    const correct = correctBy.get(e.studentId) ?? 0;
    return {
      studentId: e.studentId,
      displayName: e.student.displayName,
      attempts,
      accuracy: attempts ? correct / attempts : 0,
      overdueCount: overdueBy.get(e.studentId) ?? 0,
    };
  });

  const active = students.filter((s) => s.attempts > 0);
  const averageScore = active.length
    ? active.reduce((sum, s) => sum + s.accuracy, 0) / active.length
    : 0;

  const totals = assignments.reduce(
    (acc, a) => ({
      total: acc.total + a.targets.length,
      done: acc.done + a.targets.filter((t) => t.completedAt).length,
    }),
    { total: 0, done: 0 },
  );

  const topics = await prisma.topic.findMany({
    where: { id: { in: weakest.map((w) => w.topicId) } },
    select: { id: true, name: true },
  });
  const topicName = new Map(topics.map((t) => [t.id, t.name]));

  const studentsAtRisk = students
    .map((s) => {
      const reasons: string[] = [];
      if (s.attempts >= AT_RISK_MIN_ATTEMPTS && s.accuracy < AT_RISK_ACCURACY) {
        reasons.push(`Accuracy ${Math.round(s.accuracy * 100)}%`);
      }
      if (s.overdueCount > 0) {
        reasons.push(`${s.overdueCount} overdue assignment${s.overdueCount > 1 ? 's' : ''}`);
      }
      return { studentId: s.studentId, displayName: s.displayName, reasons };
    })
    .filter((s) => s.reasons.length > 0);

  return {
    classId,
    className: cls.name,
    studentCount: students.length,
    averageScore: round(averageScore),
    completionRate: totals.total ? round(totals.done / totals.total) : 0,
    weakestTopics: weakest.map((w) => ({
      topicId: w.topicId,
      topicName: topicName.get(w.topicId) ?? 'Unknown',
      averageMastery: round(w._avg.score ?? 0),
    })),
    studentsAtRisk,
    students: students.map((s) => ({ ...s, accuracy: round(s.accuracy) })),
    assignments: assignments.map((a) => ({
      id: a.id,
      quizTitle: a.quiz.title,
      dueAt: a.dueAt.toISOString(),
      completed: a.targets.filter((t) => t.completedAt).length,
      total: a.targets.length,
    })),
  };
}

/** FR-25: class results as CSV. */
export async function classResultsCsv(classId: string, caller: Caller): Promise<string> {
  const summary = await classSummary(classId, caller);
  const rows = [
    ['student', 'attempts', 'accuracy_percent', 'overdue_assignments'],
    ...summary.students.map((s) => [
      s.displayName,
      String(s.attempts),
      String(Math.round(s.accuracy * 100)),
      String(s.overdueCount),
    ]),
  ];
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/** Quotes a CSV cell and defuses spreadsheet formula injection (=, +, -, @). */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
