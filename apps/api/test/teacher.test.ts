import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, createTopicWithQuestions, resetDb, userSession } from './helpers.js';

beforeEach(resetDb);

describe('classes (FR-10, FR-20)', () => {
  it('creates, joins, rotates the join code and archives', async () => {
    const t = await userSession('teacher');
    const s = await userSession('student');
    const created = await api()
      .post('/api/v1/classes')
      .set(t.session.auth)
      .send({ name: 'Period 1' });
    expect(created.status).toBe(201);
    expect(created.body.joinCode).toMatch(/^[A-Z0-9]{8}$/);

    const joined = await api()
      .post('/api/v1/classes/join')
      .set(s.session.auth)
      .send({ joinCode: created.body.joinCode.toLowerCase() });
    expect(joined.status).toBe(200);
    expect(joined.body.studentCount).toBe(1);

    const rotated = await api()
      .patch(`/api/v1/classes/${created.body.id}`)
      .set(t.session.auth)
      .send({ rotateJoinCode: true });
    expect(rotated.body.joinCode).not.toBe(created.body.joinCode);
    const oldCode = await api()
      .post('/api/v1/classes/join')
      .set(s.session.auth)
      .send({ joinCode: created.body.joinCode });
    expect(oldCode.status).toBe(404);

    await api()
      .patch(`/api/v1/classes/${created.body.id}`)
      .set(t.session.auth)
      .send({ archived: true });
    const archivedJoin = await api()
      .post('/api/v1/classes/join')
      .set(s.session.auth)
      .send({ joinCode: rotated.body.joinCode });
    expect(archivedJoin.status).toBe(404);
  });

  it('validates input', async () => {
    const t = await userSession('teacher');
    expect(
      (await api().post('/api/v1/classes').set(t.session.auth).send({ name: '' })).status,
    ).toBe(400);
    const s = await userSession('student');
    expect(
      (await api().post('/api/v1/classes/join').set(s.session.auth).send({ joinCode: 'bad code!' }))
        .status,
    ).toBe(400);
  });
});

describe('question bank (FR-30..FR-32)', () => {
  it('filters, searches, creates and changes status', async () => {
    const t = await userSession('teacher');
    const topic = await createTopicWithQuestions('Fractions', 2);
    const level3 = await api()
      .get(`/api/v1/questions?topicId=${topic.id}&difficulty=3`)
      .set(t.session.auth);
    expect(level3.body.total).toBe(2);
    expect(level3.body.items.every((q: { difficulty: number }) => q.difficulty === 3)).toBe(true);

    const search = await api().get('/api/v1/questions?q=LEVEL%205').set(t.session.auth);
    expect(search.body.total).toBe(2);

    const bad = await api()
      .post('/api/v1/questions')
      .set(t.session.auth)
      .send({
        topicId: topic.id,
        difficulty: 2,
        type: 'multiple_choice',
        body: 'Pick one please',
        options: ['a', 'b'],
        correctAnswer: 'c',
        explanation: 'Because.',
      });
    expect(bad.status).toBe(400);

    const ok = await api()
      .post('/api/v1/questions')
      .set(t.session.auth)
      .send({
        topicId: topic.id,
        difficulty: 2,
        type: 'multiple_choice',
        body: 'Pick one please',
        options: ['a', 'b'],
        correctAnswer: 'b',
        explanation: 'Because.',
      });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ status: 'approved', source: 'human', options: ['a', 'b'] });

    const retired = await api()
      .patch(`/api/v1/questions/${ok.body.id}/status`)
      .set(t.session.auth)
      .send({ status: 'retired' });
    expect(retired.body.status).toBe('retired');
    expect(await prisma.auditLog.count({ where: { action: 'question.status_changed' } })).toBe(1);
  });

  it('rejects page sizes over the limit', async () => {
    const t = await userSession('teacher');
    expect((await api().get('/api/v1/questions?pageSize=1000').set(t.session.auth)).status).toBe(
      400,
    );
  });
});

describe('quizzes (FR-21, FR-22)', () => {
  it('only accepts approved questions and future due dates', async () => {
    const t = await userSession('teacher');
    const topic = await createTopicWithQuestions();
    const q = await prisma.question.findFirstOrThrow({ where: { topicId: topic.id } });
    await prisma.question.update({ where: { id: q.id }, data: { status: 'draft' } });
    const draft = await api()
      .post('/api/v1/quizzes')
      .set(t.session.auth)
      .send({ title: 'Q', topicId: topic.id, questionIds: [q.id] });
    expect(draft.status).toBe(400);
    expect(draft.body.code).toBe('QUESTION_NOT_APPROVED');

    const good = await prisma.question.findFirstOrThrow({
      where: { topicId: topic.id, status: 'approved' },
    });
    const quiz = await api()
      .post('/api/v1/quizzes')
      .set(t.session.auth)
      .send({ title: 'Q', topicId: topic.id, questionIds: [good.id] });
    const cls = await api().post('/api/v1/classes').set(t.session.auth).send({ name: 'C' });
    const past = await api()
      .post(`/api/v1/quizzes/${quiz.body.id}/assign`)
      .set(t.session.auth)
      .send({ classId: cls.body.id, dueAt: new Date(Date.now() - 1000).toISOString() });
    expect(past.status).toBe(400);
    expect(past.body.code).toBe('DUE_IN_PAST');
  });
});

describe('class summary (FR-23, FR-25)', () => {
  it('reports averages, completion, weakest topics and at-risk students', async () => {
    const t = await userSession('teacher');
    const strong = await userSession('student');
    const weak = await userSession('student');
    const topic = await createTopicWithQuestions();
    const cls = await api().post('/api/v1/classes').set(t.session.auth).send({ name: 'C' });
    for (const s of [strong, weak])
      await api()
        .post('/api/v1/classes/join')
        .set(s.session.auth)
        .send({ joinCode: cls.body.joinCode });

    for (const [s, correctRate] of [
      [strong, 1],
      [weak, 0],
    ] as const) {
      const { body } = await api()
        .post('/api/v1/practice/sessions')
        .set(s.session.auth)
        .send({ topicId: topic.id });
      for (let i = 0; i < 6; i++) {
        const next = await api()
          .get(`/api/v1/practice/sessions/${body.session.id}/next`)
          .set(s.session.auth);
        const q = await prisma.question.findUniqueOrThrow({ where: { id: next.body.question.id } });
        await api()
          .post(`/api/v1/practice/sessions/${body.session.id}/answer`)
          .set(s.session.auth)
          .send({ questionId: q.id, answer: correctRate ? q.correctAnswer : '-1', timeMs: 100 });
      }
    }

    const res = await api().get(`/api/v1/classes/${cls.body.id}/summary`).set(t.session.auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ studentCount: 2, averageScore: 0.5, completionRate: 0 });
    expect(res.body.weakestTopics[0].topicName).toBe('Fractions');
    expect(res.body.studentsAtRisk).toHaveLength(1);
    expect(res.body.studentsAtRisk[0].studentId).toBe(weak.user.id);

    const csv = await api().get(`/api/v1/classes/${cls.body.id}/results.csv`).set(t.session.auth);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.split('\n')[0]).toBe(
      '"student","attempts","accuracy_percent","overdue_assignments"',
    );
  });
});
