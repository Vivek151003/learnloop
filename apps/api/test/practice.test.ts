import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, createTopicWithQuestions, resetDb, userSession, type Session } from './helpers.js';

beforeEach(resetDb);

async function answer(s: Session, sessionId: string, correct: boolean) {
  const next = await api().get(`/api/v1/practice/sessions/${sessionId}/next`).set(s.auth);
  const q = await prisma.question.findUniqueOrThrow({ where: { id: next.body.question.id } });
  const res = await api()
    .post(`/api/v1/practice/sessions/${sessionId}/answer`)
    .set(s.auth)
    .send({ questionId: q.id, answer: correct ? q.correctAnswer : '-999', timeMs: 5000 });
  expect(res.status).toBe(200);
  return res.body;
}

describe('adaptive practice (FR-11, FR-12, FR-13, FR-16)', () => {
  it('serves one question at a time and never leaks the answer', async () => {
    const { session: s } = await userSession('student');
    const topic = await createTopicWithQuestions();
    const start = await api()
      .post('/api/v1/practice/sessions')
      .set(s.auth)
      .send({ topicId: topic.id });
    expect(start.status).toBe(201);
    expect(start.body.session.currentDifficulty).toBe(2);

    const a = await api()
      .get(`/api/v1/practice/sessions/${start.body.session.id}/next`)
      .set(s.auth);
    const b = await api()
      .get(`/api/v1/practice/sessions/${start.body.session.id}/next`)
      .set(s.auth);
    expect(a.body.question.id).toBe(b.body.question.id);
    expect(a.body.question).not.toHaveProperty('correctAnswer');
    expect(a.body.question).not.toHaveProperty('explanation');
  });

  it('raises difficulty after two right and lowers it after two wrong', async () => {
    const { session: s } = await userSession('student');
    const topic = await createTopicWithQuestions();
    const { body } = await api()
      .post('/api/v1/practice/sessions')
      .set(s.auth)
      .send({ topicId: topic.id });
    const id = body.session.id;

    const r1 = await answer(s, id, true);
    expect(r1).toMatchObject({ correct: true, newDifficulty: 2 });
    expect(r1.explanation).toBeTruthy();
    const r2 = await answer(s, id, true);
    expect(r2.newDifficulty).toBe(3);
    await answer(s, id, false);
    const r4 = await answer(s, id, false);
    expect(r4).toMatchObject({ correct: false, newDifficulty: 2, explanationSource: 'static' });
    expect(r4.correctAnswer).toBeTruthy();

    const mastery = await prisma.mastery.findFirstOrThrow({ where: { topicId: topic.id } });
    expect(mastery.attempts).toBe(4);
    expect(mastery.score).toBeCloseTo(0.5, 2);
  });

  it('rejects answers to a question that is not current, and double submits', async () => {
    const { session: s } = await userSession('student');
    const topic = await createTopicWithQuestions();
    const { body } = await api()
      .post('/api/v1/practice/sessions')
      .set(s.auth)
      .send({ topicId: topic.id });
    const id = body.session.id;
    const next = await api().get(`/api/v1/practice/sessions/${id}/next`).set(s.auth);
    const other = await prisma.question.findFirstOrThrow({
      where: { id: { not: next.body.question.id } },
    });

    const wrong = await api()
      .post(`/api/v1/practice/sessions/${id}/answer`)
      .set(s.auth)
      .send({ questionId: other.id, answer: '1', timeMs: 10 });
    expect(wrong.status).toBe(409);
    const payload = { questionId: next.body.question.id, answer: '1', timeMs: 10 };
    const [x, y] = await Promise.all([
      api().post(`/api/v1/practice/sessions/${id}/answer`).set(s.auth).send(payload),
      api().post(`/api/v1/practice/sessions/${id}/answer`).set(s.auth).send(payload),
    ]);
    expect([x.status, y.status].sort()).toEqual([200, 409]);
    expect(await prisma.attempt.count({ where: { sessionId: id } })).toBe(1);
  });

  it('resumes an unfinished session instead of starting a new one', async () => {
    const { session: s } = await userSession('student');
    const topic = await createTopicWithQuestions();
    const first = await api()
      .post('/api/v1/practice/sessions')
      .set(s.auth)
      .send({ topicId: topic.id });
    await answer(s, first.body.session.id, true);
    const again = await api()
      .post('/api/v1/practice/sessions')
      .set(s.auth)
      .send({ topicId: topic.id });
    expect(again.body.resumed).toBe(true);
    expect(again.body.session.id).toBe(first.body.session.id);
    expect(again.body.session.answeredCount).toBe(1);
  });

  it('completes after 10 questions and then serves nothing', async () => {
    const { session: s } = await userSession('student');
    const topic = await createTopicWithQuestions();
    const { body } = await api()
      .post('/api/v1/practice/sessions')
      .set(s.auth)
      .send({ topicId: topic.id });
    let last;
    for (let i = 0; i < 10; i++) last = await answer(s, body.session.id, i % 3 !== 0);
    expect(last.session).toMatchObject({ completed: true, answeredCount: 10 });
    const done = await api().get(`/api/v1/practice/sessions/${body.session.id}/next`).set(s.auth);
    expect(done.body.question).toBeNull();
  });
});

describe('assignments (FR-17, FR-22)', () => {
  it('a student completes assigned work in quiz order and it is marked done', async () => {
    const teacher = await userSession('teacher');
    const student = await userSession('student');
    const topic = await createTopicWithQuestions();
    const cls = await api().post('/api/v1/classes').set(teacher.session.auth).send({ name: 'C' });
    await api()
      .post('/api/v1/classes/join')
      .set(student.session.auth)
      .send({ joinCode: cls.body.joinCode });
    const questions = await prisma.question.findMany({
      where: { topicId: topic.id },
      take: 3,
      orderBy: { difficulty: 'desc' },
    });
    const quiz = await api()
      .post('/api/v1/quizzes')
      .set(teacher.session.auth)
      .send({ title: 'Q', topicId: topic.id, questionIds: questions.map((q) => q.id) });
    const assigned = await api()
      .post(`/api/v1/quizzes/${quiz.body.id}/assign`)
      .set(teacher.session.auth)
      .send({ classId: cls.body.id, dueAt: new Date(Date.now() + 86_400_000).toISOString() });
    expect(assigned.body.studentCount).toBe(1);

    const list = await api().get('/api/v1/assignments').set(student.session.auth);
    expect(list.body[0]).toMatchObject({ completed: false, overdue: false, questionCount: 3 });

    const start = await api()
      .post('/api/v1/practice/sessions')
      .set(student.session.auth)
      .send({ assignmentId: assigned.body.assignmentId });
    const id = start.body.session.id;
    for (const q of questions) {
      const next = await api()
        .get(`/api/v1/practice/sessions/${id}/next`)
        .set(student.session.auth);
      expect(next.body.question.id).toBe(q.id);
      await api()
        .post(`/api/v1/practice/sessions/${id}/answer`)
        .set(student.session.auth)
        .send({ questionId: q.id, answer: q.correctAnswer, timeMs: 100 });
    }
    const after = await api().get('/api/v1/assignments').set(student.session.auth);
    expect(after.body[0].completed).toBe(true);
    const again = await api()
      .post('/api/v1/practice/sessions')
      .set(student.session.auth)
      .send({ assignmentId: assigned.body.assignmentId });
    expect(again.status).toBe(409);
  });

  it('students who join later receive whole-class assignments', async () => {
    const teacher = await userSession('teacher');
    const late = await userSession('student');
    const topic = await createTopicWithQuestions();
    const cls = await api().post('/api/v1/classes').set(teacher.session.auth).send({ name: 'C' });
    const q = await prisma.question.findFirstOrThrow({ where: { topicId: topic.id } });
    const quiz = await api()
      .post('/api/v1/quizzes')
      .set(teacher.session.auth)
      .send({ title: 'Q', topicId: topic.id, questionIds: [q.id] });
    await api()
      .post(`/api/v1/quizzes/${quiz.body.id}/assign`)
      .set(teacher.session.auth)
      .send({ classId: cls.body.id, dueAt: new Date(Date.now() + 86_400_000).toISOString() });
    await api()
      .post('/api/v1/classes/join')
      .set(late.session.auth)
      .send({ joinCode: cls.body.joinCode });
    const list = await api().get('/api/v1/assignments').set(late.session.auth);
    expect(list.body).toHaveLength(1);
  });
});
