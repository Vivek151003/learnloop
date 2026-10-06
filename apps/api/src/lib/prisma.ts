import { PrismaClient } from '@prisma/client';

// Prisma issues parameterised queries only; raw SQL in this codebase uses tagged
// templates, which Prisma also parameterises (SEC-5).
export const prisma = new PrismaClient();
