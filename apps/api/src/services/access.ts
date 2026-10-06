import type { Role } from '@learnloop/shared';
import { prisma } from '../lib/prisma.js';
import { forbidden, notFound } from '../lib/errors.js';

export interface Caller {
  id: string;
  role: Role;
}

// Object-level ownership checks (SEC-3). Every route that takes an ID goes
// through one of these, so changing an ID in the URL never exposes other data.

/** The class must exist and belong to the calling teacher (admins pass). */
export async function assertClassOwner(classId: string, caller: Caller) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) throw notFound('Class');
  if (caller.role !== 'admin' && cls.teacherId !== caller.id) throw forbidden();
  return cls;
}

/** A student may see their own data; a teacher may see students in their classes. */
export async function assertCanViewStudent(studentId: string, caller: Caller) {
  if (caller.role === 'admin' || caller.id === studentId) return;
  if (caller.role === 'teacher') {
    const enrolled = await prisma.enrollment.findFirst({
      where: { studentId, class: { teacherId: caller.id } },
      select: { studentId: true },
    });
    if (enrolled) return;
  }
  throw forbidden();
}

export async function assertQuizOwner(quizId: string, caller: Caller) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) throw notFound('Quiz');
  if (caller.role !== 'admin' && quiz.ownerId !== caller.id) throw forbidden();
  return quiz;
}
