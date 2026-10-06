import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, createTopicWithQuestions, resetDb, userSession } from './helpers.js';

// TST-3: object-level access control. Changing an ID never exposes someone else's data.

beforeEach(resetDb);

async function world() {
  const teacherA = await userSession('teacher');
  const teacherB = await userSession('teacher');
  const studentA = await userSession('student');
  const studentB = await userSession('student');
  const classA = await api().post('/api/v1/classes').set(teacherA.session.auth).send({ name: 'A' });
  const classB = await api().post('/api/v1/classes').set(teacherB.session.auth).send({ name: 'B' });
  await api()
    .post('/api/v1/classes/join')
    .set(studentA.session.auth)
    .send({ joinCode: classA.body.joinCode });
  await api()
    .post('/api/v1/classes/join')
    .set(studentB.session.auth)
    .send({ joinCode: classB.body.joinCode });
  return { teacherA, teacherB, studentA, studentB, classA: classA.body, classB: classB.body };
}

describe('students', () => {
  it('cannot read another student’s progress or attempts', async () => {
    const w = await world();
    const own = await api()
      .get(`/api/v1/students/${w.studentA.user.id}/progress`)
      .set(w.studentA.session.auth);
    expect(own.status).toBe(200);
    for (const path of ['progress', 'attempts']) {
      const res = await api()
        .get(`/api/v1/students/${w.studentB.user.id}/${path}`)
        .set(w.studentA.session.auth);
      expect(res.status).toBe(403);
    }
  });

  it('cannot use or answer another student’s practice session', async () => {
    const w = await world();
    const topic = await createTopicWithQuestions();
    const s = await api()
      .post('/api/v1/practice/sessions')
      .set(w.studentB.session.auth)
      .send({ topicId: topic.id });
    const id = s.body.session.id;
    expect(
      (await api().get(`/api/v1/practice/sessions/${id}/next`).set(w.studentA.session.auth)).status,
    ).toBe(403);
    const next = await api()
      .get(`/api/v1/practice/sessions/${id}/next`)
      .set(w.studentB.session.auth);
    const answer = await api()
      .post(`/api/v1/practice/sessions/${id}/answer`)
      .set(w.studentA.session.auth)
      .send({ questionId: next.body.question.id, answer: '1', timeMs: 1000 });
    expect(answer.status).toBe(403);
  });

  it('cannot start another student’s assignment', async () => {
    const w = await world();
    const topic = await createTopicWithQuestions();
    const qs = await prisma.question.findMany({ where: { topicId: topic.id }, take: 2 });
    const quiz = await api()
      .post('/api/v1/quizzes')
      .set(w.teacherB.session.auth)
      .send({ title: 'Q', topicId: topic.id, questionIds: qs.map((q) => q.id) });
    const assigned = await api()
      .post(`/api/v1/quizzes/${quiz.body.id}/assign`)
      .set(w.teacherB.session.auth)
      .send({ classId: w.classB.id, dueAt: new Date(Date.now() + 86_400_000).toISOString() });
    const res = await api()
      .post('/api/v1/practice/sessions')
      .set(w.studentA.session.auth)
      .send({ assignmentId: assigned.body.assignmentId });
    expect(res.status).toBe(404);
  });

  it('do not see join codes', async () => {
    const w = await world();
    const res = await api().get('/api/v1/classes').set(w.studentA.session.auth);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].joinCode).toBeNull();
  });
});

describe('teachers', () => {
  it('cannot read, change or export another teacher’s class', async () => {
    const w = await world();
    const id = w.classB.id;
    expect(
      (await api().get(`/api/v1/classes/${id}/summary`).set(w.teacherA.session.auth)).status,
    ).toBe(403);
    expect(
      (await api().get(`/api/v1/classes/${id}/results.csv`).set(w.teacherA.session.auth)).status,
    ).toBe(403);
    expect(
      (
        await api()
          .patch(`/api/v1/classes/${id}`)
          .set(w.teacherA.session.auth)
          .send({ archived: true })
      ).status,
    ).toBe(403);
    expect(
      (await api().get(`/api/v1/classes/${w.classA.id}/summary`).set(w.teacherA.session.auth))
        .status,
    ).toBe(200);
  });

  it('only see their own classes in the list', async () => {
    const w = await world();
    const res = await api().get('/api/v1/classes').set(w.teacherA.session.auth);
    expect(res.body.map((c: { id: string }) => c.id)).toEqual([w.classA.id]);
  });

  it('can read their own students but not other teachers’ students', async () => {
    const w = await world();
    expect(
      (
        await api()
          .get(`/api/v1/students/${w.studentA.user.id}/progress`)
          .set(w.teacherA.session.auth)
      ).status,
    ).toBe(200);
    expect(
      (
        await api()
          .get(`/api/v1/students/${w.studentB.user.id}/progress`)
          .set(w.teacherA.session.auth)
      ).status,
    ).toBe(403);
    expect(
      (
        await api()
          .get(`/api/v1/students/${w.studentB.user.id}/attempts`)
          .set(w.teacherA.session.auth)
      ).status,
    ).toBe(403);
  });

  it('cannot assign their quiz to another teacher’s class or assign another teacher’s quiz', async () => {
    const w = await world();
    const topic = await createTopicWithQuestions();
    const qs = await prisma.question.findMany({ where: { topicId: topic.id }, take: 2 });
    const quizA = await api()
      .post('/api/v1/quizzes')
      .set(w.teacherA.session.auth)
      .send({ title: 'A', topicId: topic.id, questionIds: qs.map((q) => q.id) });
    const due = new Date(Date.now() + 86_400_000).toISOString();
    const intoB = await api()
      .post(`/api/v1/quizzes/${quizA.body.id}/assign`)
      .set(w.teacherA.session.auth)
      .send({ classId: w.classB.id, dueAt: due });
    expect(intoB.status).toBe(403);
    const stealQuiz = await api()
      .post(`/api/v1/quizzes/${quizA.body.id}/assign`)
      .set(w.teacherB.session.auth)
      .send({ classId: w.classB.id, dueAt: due });
    expect(stealQuiz.status).toBe(403);
    expect(
      (await api().get(`/api/v1/quizzes/${quizA.body.id}`).set(w.teacherB.session.auth)).status,
    ).toBe(403);
  });

  it('cannot assign to students outside the class', async () => {
    const w = await world();
    const topic = await createTopicWithQuestions();
    const qs = await prisma.question.findMany({ where: { topicId: topic.id }, take: 2 });
    const quiz = await api()
      .post('/api/v1/quizzes')
      .set(w.teacherA.session.auth)
      .send({ title: 'A', topicId: topic.id, questionIds: qs.map((q) => q.id) });
    const res = await api()
      .post(`/api/v1/quizzes/${quiz.body.id}/assign`)
      .set(w.teacherA.session.auth)
      .send({
        classId: w.classA.id,
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
        studentIds: [w.studentB.user.id],
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NOT_ENROLLED');
  });
});

describe('role and status changes take effect immediately', () => {
  it('a disabled user’s existing access token stops working', async () => {
    const { user, session } = await userSession('teacher');
    expect((await api().get('/api/v1/me').set(session.auth)).status).toBe(200);
    await prisma.user.update({ where: { id: user.id }, data: { disabled: true } });
    expect((await api().get('/api/v1/me').set(session.auth)).status).toBe(401);
  });

  it('a demoted teacher loses teacher routes with the same token', async () => {
    const { user, session } = await userSession('teacher');
    await prisma.user.update({ where: { id: user.id }, data: { role: 'student' } });
    expect((await api().post('/api/v1/classes').set(session.auth).send({ name: 'X' })).status).toBe(
      403,
    );
  });
});
