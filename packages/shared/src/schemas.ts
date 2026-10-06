import { z } from 'zod';

// Request schemas are shared by the API (validation) and the web app (forms),
// so both sides agree on the same rules (NFR-11). Every object is `.strict()`
// so unknown fields are rejected (SEC-4).

export const ROLES = ['student', 'teacher', 'admin'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const QUESTION_TYPES = ['multiple_choice', 'numeric'] as const;
export const questionTypeSchema = z.enum(QUESTION_TYPES);
export type QuestionType = z.infer<typeof questionTypeSchema>;

export const QUESTION_STATUSES = ['draft', 'approved', 'retired'] as const;
export const questionStatusSchema = z.enum(QUESTION_STATUSES);
export type QuestionStatus = z.infer<typeof questionStatusSchema>;

export const PASSWORD_MIN_LENGTH = 12;
export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 5;

const id = z.string().uuid();
const email = z.string().trim().toLowerCase().email().max(254);
const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128);
const displayName = z.string().trim().min(1).max(60);
const difficulty = z.coerce.number().int().min(MIN_DIFFICULTY).max(MAX_DIFFICULTY);

export const idParamSchema = z.object({ id }).strict();

export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type Pagination = z.infer<typeof paginationSchema>;

// ---- Auth (FR-1..FR-5) ----
export const registerSchema = z
  .object({
    email,
    password,
    displayName,
    // Admins are never self-registered; they are seeded or promoted (FR-40).
    role: z.enum(['student', 'teacher']).default('student'),
  })
  .strict();
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email }).strict();
export const resetPasswordSchema = z
  .object({ token: z.string().min(20).max(200), password })
  .strict();

export const updateMeSchema = z.object({ displayName }).strict();
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

// ---- Classes (FR-10, FR-20) ----
export const createClassSchema = z.object({ name: z.string().trim().min(1).max(80) }).strict();
export type CreateClassInput = z.infer<typeof createClassSchema>;

export const joinClassSchema = z
  .object({
    joinCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{6,10}$/, 'Join codes are 6 to 10 letters or digits'),
  })
  .strict();
export type JoinClassInput = z.infer<typeof joinClassSchema>;

export const updateClassSchema = z
  .object({ archived: z.boolean().optional(), rotateJoinCode: z.literal(true).optional() })
  .strict();

// ---- Questions (FR-30..FR-32) ----
export const createQuestionSchema = z
  .object({
    topicId: id,
    difficulty,
    type: questionTypeSchema,
    body: z.string().trim().min(5).max(1000),
    options: z.array(z.string().trim().min(1).max(200)).min(2).max(6).optional(),
    correctAnswer: z.string().trim().min(1).max(200),
    explanation: z.string().trim().min(5).max(1500),
  })
  .strict()
  .superRefine((q, ctx) => {
    if (q.type === 'multiple_choice') {
      if (!q.options) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'Options are required' });
      } else if (!q.options.includes(q.correctAnswer)) {
        ctx.addIssue({
          code: 'custom',
          path: ['correctAnswer'],
          message: 'Correct answer must be one of the options',
        });
      }
    }
    if (q.type === 'numeric' && parseNumericAnswer(q.correctAnswer) === null) {
      ctx.addIssue({ code: 'custom', path: ['correctAnswer'], message: 'Must be a number' });
    }
  });
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

export const questionQuerySchema = paginationSchema
  .extend({
    topicId: id.optional(),
    difficulty: difficulty.optional(),
    status: questionStatusSchema.optional(),
    q: z.string().trim().max(100).optional(),
  })
  .strict();
export type QuestionQuery = z.infer<typeof questionQuerySchema>;

export const updateQuestionStatusSchema = z.object({ status: questionStatusSchema }).strict();

// ---- Quizzes and assignments (FR-21, FR-22) ----
export const createQuizSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    topicId: id,
    questionIds: z.array(id).min(1).max(50),
  })
  .strict()
  .refine((q) => new Set(q.questionIds).size === q.questionIds.length, {
    path: ['questionIds'],
    message: 'Questions must be unique',
  });
export type CreateQuizInput = z.infer<typeof createQuizSchema>;

export const assignQuizSchema = z
  .object({
    classId: id,
    dueAt: z.coerce.date(),
    studentIds: z.array(id).min(1).max(200).optional(),
  })
  .strict();
export type AssignQuizInput = z.infer<typeof assignQuizSchema>;

// ---- Practice (FR-11, FR-12, FR-16, FR-17) ----
export const startSessionSchema = z
  .object({ topicId: id.optional(), assignmentId: id.optional() })
  .strict()
  .refine((s) => Boolean(s.topicId) !== Boolean(s.assignmentId), {
    message: 'Provide either topicId or assignmentId',
  });
export type StartSessionInput = z.infer<typeof startSessionSchema>;

export const submitAnswerSchema = z
  .object({
    questionId: id,
    answer: z.string().trim().min(1).max(200),
    timeMs: z.coerce
      .number()
      .int()
      .min(0)
      .max(60 * 60 * 1000),
  })
  .strict();
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;

// ---- Admin (FR-40, FR-41) ----
export const adminUserQuerySchema = paginationSchema
  .extend({ role: roleSchema.optional(), q: z.string().trim().max(100).optional() })
  .strict();

export const adminUpdateUserSchema = z
  .object({ role: roleSchema.optional(), disabled: z.boolean().optional() })
  .strict()
  .refine((u) => u.role !== undefined || u.disabled !== undefined, {
    message: 'Nothing to update',
  });
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

export const auditQuerySchema = paginationSchema
  .extend({ action: z.string().trim().max(60).optional(), actorId: id.optional() })
  .strict();

/**
 * Parses a numeric answer such as "12", "-3.5", "3/4" or "1,250".
 * Returns null when the text is not a number.
 */
export function parseNumericAnswer(raw: string): number | null {
  const text = raw
    .trim()
    .replace(/,/g, '')
    .replace(/[\u2212\u2013]/g, '-');
  const fraction = /^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/.exec(text);
  if (fraction) {
    const den = Number(fraction[2]);
    return den === 0 ? null : Number(fraction[1]) / den;
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  return Number(text);
}
