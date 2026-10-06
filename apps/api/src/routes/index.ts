import { adminModule } from './admin.js';
import { authModule } from './auth.js';
import { classesModule } from './classes.js';
import { healthModule } from './health.js';
import { meModule } from './me.js';
import { practiceModule } from './practice.js';
import { questionsModule, topicsModule } from './questions.js';
import { assignmentsModule, quizzesModule } from './quizzes.js';
import { studentsModule } from './students.js';

export const modules = [
  healthModule,
  authModule,
  meModule,
  topicsModule,
  classesModule,
  questionsModule,
  quizzesModule,
  assignmentsModule,
  practiceModule,
  studentsModule,
  adminModule,
];
