import { describe, expect, it } from 'vitest';
import {
  createQuestionSchema,
  parseNumericAnswer,
  registerSchema,
  startSessionSchema,
} from './schemas.js';

describe('parseNumericAnswer', () => {
  it.each([
    ['12', 12],
    [' -3.5 ', -3.5],
    ['3/4', 0.75],
    ['1,250', 1250],
  ])('parses %s', (input, expected) => {
    expect(parseNumericAnswer(input)).toBe(expected);
  });

  it.each(['abc', '1/0', '', '2x', '1e5'])('rejects %s', (input) => {
    expect(parseNumericAnswer(input)).toBeNull();
  });
});

describe('registerSchema', () => {
  const valid = { email: 'A@Example.com', password: 'correct horse battery', displayName: 'Ana' };

  it('normalises email and defaults role to student', () => {
    expect(registerSchema.parse(valid)).toMatchObject({ email: 'a@example.com', role: 'student' });
  });

  it('rejects short passwords', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
  });

  it('rejects unknown fields and self-registered admins', () => {
    expect(registerSchema.safeParse({ ...valid, isAdmin: true }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, role: 'admin' }).success).toBe(false);
  });
});

describe('createQuestionSchema', () => {
  const base = {
    topicId: '6f1c1c1e-5b8a-4b8e-9c55-2f1f0d7c1a11',
    difficulty: 2,
    body: 'What is 2 + 2?',
    explanation: 'Add the two numbers together.',
  };

  it('requires the correct answer to be one of the options', () => {
    const result = createQuestionSchema.safeParse({
      ...base,
      type: 'multiple_choice',
      options: ['3', '5'],
      correctAnswer: '4',
    });
    expect(result.success).toBe(false);
  });

  it('requires numeric answers to be numbers', () => {
    expect(
      createQuestionSchema.safeParse({ ...base, type: 'numeric', correctAnswer: 'four' }).success,
    ).toBe(false);
    expect(
      createQuestionSchema.safeParse({ ...base, type: 'numeric', correctAnswer: '4' }).success,
    ).toBe(true);
  });
});

describe('startSessionSchema', () => {
  it('needs exactly one of topicId or assignmentId', () => {
    expect(startSessionSchema.safeParse({}).success).toBe(false);
    expect(
      startSessionSchema.safeParse({
        topicId: '6f1c1c1e-5b8a-4b8e-9c55-2f1f0d7c1a11',
        assignmentId: '6f1c1c1e-5b8a-4b8e-9c55-2f1f0d7c1a12',
      }).success,
    ).toBe(false);
  });
});
