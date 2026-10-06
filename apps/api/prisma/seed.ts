/**
 * Seeds synthetic demo data (SRS 8.1): 1 admin, 2 teachers, 30 students and
 * 300 questions, plus classes, quizzes, assignments and practice history.
 * All data is synthetic (SRS 2.4). Safe to run repeatedly: it does nothing if
 * the demo admin already exists, unless run with --reset.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { createRng, generateBank, TOPICS } from './questionBank.js';
import { updateMastery } from '../src/services/adaptive.js';

const prisma = new PrismaClient();
const rng = createRng(20261006);

export const DEMO_PASSWORD = 'LearnLoop!2026';
const DAY = 86_400_000;

const FIRST = [
  'Ava',
  'Ben',
  'Chloe',
  'Dev',
  'Ella',
  'Felix',
  'Gia',
  'Hugo',
  'Isha',
  'Jon',
  'Kai',
  'Lena',
  'Milo',
  'Nora',
  'Omar',
  'Pia',
  'Quinn',
  'Ravi',
  'Sara',
  'Tom',
  'Uma',
  'Vik',
  'Wren',
  'Xia',
  'Yusuf',
  'Zoe',
  'Aria',
  'Bo',
  'Cy',
  'Dina',
];
const LAST = ['Shah', 'Lee', 'Patel', 'Garcia', 'Kim', 'Nguyen', 'Brown', 'Singh', 'Ali', 'Chen'];

async function reset() {
  // TRUNCATE also clears the append-only audit table, whose trigger blocks DELETE.
  await prisma.$executeRawUnsafe(
    'TRUNCATE audit_logs, ai_calls, attempts, practice_sessions, assignment_targets, assignments, quiz_questions, quizzes, mastery, questions, topics, enrollments, classes, password_reset_tokens, refresh_tokens, users RESTART IDENTITY CASCADE',
  );
}

async function main() {
  const force = process.argv.includes('--reset');
  const existing = await prisma.user.findUnique({ where: { email: 'admin@learnloop.dev' } });
  if (existing && !force) {
    console.log('Seed data already present. Run with --reset to recreate it.');
    return;
  }
  if (force) await reset();

  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  // ---- Users ----
  const admin = await prisma.user.create({
    data: { email: 'admin@learnloop.dev', displayName: 'Ada Admin', role: 'admin', passwordHash },
  });
  const teachers = await Promise.all(
    [
      { email: 'teacher1@learnloop.dev', displayName: 'Ms. Rivera' },
      { email: 'teacher2@learnloop.dev', displayName: 'Mr. Okafor' },
    ].map((t) => prisma.user.create({ data: { ...t, role: 'teacher', passwordHash } })),
  );
  const students = await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      prisma.user.create({
        data: {
          email: `student${i + 1}@learnloop.dev`,
          displayName: `${FIRST[i]} ${LAST[i % LAST.length]}`,
          role: 'student',
          passwordHash,
        },
      }),
    ),
  );

  // ---- Topics and the 300-question bank ----
  const topics = new Map<string, string>();
  for (const t of TOPICS) {
    const row = await prisma.topic.create({ data: { name: t.name, gradeLevel: t.gradeLevel } });
    topics.set(t.name, row.id);
  }
  const bank = generateBank(rng, 300);
  const questionRows: Prisma.QuestionCreateManyInput[] = bank.map(({ topicName, question }) => ({
    id: randomUUID(),
    topicId: topics.get(topicName)!,
    difficulty: question.difficulty,
    type: question.type,
    body: question.body,
    options: question.options,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    status: 'approved',
    source: 'human',
    createdById: teachers[0]!.id,
  }));
  // A few drafts so the approval flow has something to show.
  for (const q of questionRows.slice(-6)) q.status = 'draft';
  await prisma.question.createMany({ data: questionRows });

  // ---- Classes: 15 students each, with fixed demo join codes ----
  const classA = await prisma.class.create({
    data: { name: 'Grade 7 Maths A', teacherId: teachers[0]!.id, joinCode: 'GRADE7AA' },
  });
  const classB = await prisma.class.create({
    data: { name: 'Grade 8 Maths B', teacherId: teachers[1]!.id, joinCode: 'GRADE8BB' },
  });
  // student1 is left out of class A on purpose, so the demo can show joining with a code.
  const inA = students.slice(1, 15);
  const inB = students.slice(15, 30);
  await prisma.enrollment.createMany({
    data: [
      ...inA.map((s) => ({ classId: classA.id, studentId: s.id })),
      ...inB.map((s) => ({ classId: classB.id, studentId: s.id })),
    ],
  });

  // ---- Quizzes and assignments: one overdue, one upcoming per class ----
  const approved = questionRows.filter((q) => q.status === 'approved');
  const quizFor = async (ownerId: string, topicName: string, title: string) => {
    const topicId = topics.get(topicName)!;
    const qs = approved.filter((q) => q.topicId === topicId).slice(0, 6);
    return prisma.quiz.create({
      data: {
        ownerId,
        topicId,
        title,
        status: 'published',
        questions: { create: qs.map((q, position) => ({ questionId: q.id!, position })) },
      },
    });
  };
  const plan = [
    {
      cls: classA,
      members: inA,
      teacher: teachers[0]!,
      topic: 'Fractions',
      title: 'Fractions warm-up',
    },
    {
      cls: classA,
      members: inA,
      teacher: teachers[0]!,
      topic: 'Percentages',
      title: 'Percentages check-in',
    },
    {
      cls: classB,
      members: inB,
      teacher: teachers[1]!,
      topic: 'Linear Equations',
      title: 'Equations practice',
    },
    {
      cls: classB,
      members: inB,
      teacher: teachers[1]!,
      topic: 'Exponents',
      title: 'Exponent rules quiz',
    },
  ];
  for (const [i, p] of plan.entries()) {
    const quiz = await quizFor(p.teacher.id, p.topic, p.title);
    const overdue = i % 2 === 0;
    await prisma.assignment.create({
      data: {
        quizId: quiz.id,
        classId: p.cls.id,
        dueAt: new Date(Date.now() + (overdue ? -2 : 5) * DAY),
        targets: {
          create: p.members.map((s) => ({
            studentId: s.id,
            // About two thirds finished the overdue one; nobody has started the upcoming one.
            completedAt: overdue && rng() < 0.66 ? new Date(Date.now() - 3 * DAY) : null,
          })),
        },
      },
    });
  }

  // ---- Practice history over the last 14 days, so dashboards have data ----
  const byTopic = new Map<string, typeof approved>();
  for (const q of approved) byTopic.set(q.topicId, [...(byTopic.get(q.topicId) ?? []), q]);
  const topicIds = [...topics.values()];

  for (const student of students.slice(1)) {
    const skill = 0.3 + rng() * 0.6; // chance of a correct answer
    const mastery = new Map<string, { score: number; attempts: number }>();
    const sessions = 1 + Math.floor(rng() * 4);
    for (let s = 0; s < sessions; s++) {
      const topicId = topicIds[Math.floor(rng() * topicIds.length)]!;
      const pool = byTopic.get(topicId) ?? [];
      const startedAt = new Date(Date.now() - Math.floor(rng() * 13 + 1) * DAY);
      const session = await prisma.practiceSession.create({
        data: {
          studentId: student.id,
          topicId,
          currentDifficulty: 2,
          totalQuestions: 10,
          answeredCount: 10,
          startedAt,
          completedAt: new Date(startedAt.getTime() + 15 * 60_000),
        },
      });
      let correctCount = 0;
      const attempts: Prisma.AttemptCreateManyInput[] = [];
      for (let k = 0; k < 10; k++) {
        const q = pool[Math.floor(rng() * pool.length)]!;
        const correct = rng() < skill - (q.difficulty - 3) * 0.08;
        if (correct) correctCount++;
        const m = mastery.get(topicId) ?? { score: 0, attempts: 0 };
        mastery.set(topicId, {
          score: updateMastery(m.score, m.attempts, correct),
          attempts: m.attempts + 1,
        });
        attempts.push({
          studentId: student.id,
          questionId: q.id!,
          sessionId: session.id,
          answer: correct ? q.correctAnswer : 'wrong',
          correct,
          difficulty: q.difficulty,
          timeMs: 8_000 + Math.floor(rng() * 40_000),
          createdAt: new Date(startedAt.getTime() + k * 60_000),
        });
      }
      await prisma.attempt.createMany({ data: attempts });
      await prisma.practiceSession.update({ where: { id: session.id }, data: { correctCount } });
    }
    await prisma.mastery.createMany({
      data: [...mastery.entries()].map(([topicId, m]) => ({
        studentId: student.id,
        topicId,
        ...m,
      })),
    });
  }

  console.log(
    `Seeded: 1 admin, ${teachers.length} teachers, ${students.length} students, ${questionRows.length} questions, 2 classes, ${plan.length} assignments.`,
  );
  console.log(`Demo password for every account: ${DEMO_PASSWORD}`);
  console.log(
    `Admin: ${admin.email} | Teachers: teacher1@learnloop.dev, teacher2@learnloop.dev | Students: student1..30@learnloop.dev`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
