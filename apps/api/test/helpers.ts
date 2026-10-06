import request from 'supertest';
import argon2 from 'argon2';
import type { Role } from '@learnloop/shared';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

export const app = createApp();
export const PASSWORD = 'correct horse battery staple';
let passwordHash: string | undefined;

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE audit_logs, ai_calls, attempts, practice_sessions, assignment_targets, assignments, quiz_questions, quizzes, mastery, questions, topics, enrollments, classes, password_reset_tokens, refresh_tokens, users RESTART IDENTITY CASCADE',
  );
}

let counter = 0;
export async function createUser(
  role: Role,
  overrides: { email?: string; displayName?: string } = {},
) {
  passwordHash ??= await argon2.hash(PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 4096,
    timeCost: 2,
  });
  counter++;
  return prisma.user.create({
    data: {
      email: overrides.email ?? `${role}${counter}@test.dev`,
      displayName: overrides.displayName ?? `${role} ${counter}`,
      role,
      passwordHash,
    },
  });
}

export interface Session {
  token: string;
  csrf: string;
  cookies: string[];
  userId: string;
  auth: { Authorization: string };
}

export async function login(email: string, password = PASSWORD): Promise<Session> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200)
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  return {
    token: res.body.accessToken,
    csrf: res.body.csrfToken,
    cookies,
    userId: res.body.user.id,
    auth: { Authorization: `Bearer ${res.body.accessToken}` },
  };
}

export async function userSession(role: Role) {
  const user = await createUser(role);
  return { user, session: await login(user.email) };
}

/** A topic with approved questions at every difficulty (numeric answers 1..n). */
export async function createTopicWithQuestions(name = 'Fractions', perLevel = 4) {
  const topic = await prisma.topic.create({ data: { name, gradeLevel: 6 } });
  const data = [];
  for (let d = 1; d <= 5; d++) {
    for (let i = 0; i < perLevel; i++) {
      data.push({
        topicId: topic.id,
        difficulty: d,
        type: 'numeric' as const,
        body: `${name} level ${d} question ${i}: what is ${d} + ${i}?`,
        correctAnswer: String(d + i),
        explanation: `Add ${d} and ${i}.`,
        status: 'approved' as const,
      });
    }
  }
  await prisma.question.createMany({ data });
  return topic;
}

export const api = () => request(app);
