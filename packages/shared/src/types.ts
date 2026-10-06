import type { QuestionStatus, QuestionType, Role } from './schemas.js';

// Response shapes returned by the API and consumed by the web app (NFR-11).

export interface ApiError {
  code: string;
  message: string;
  requestId: string;
  details?: { path: string; message: string }[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  disabled: boolean;
  createdAt: string;
}

export interface AuthResponse {
  user: UserDto;
  accessToken: string;
  csrfToken: string;
}

export interface TopicDto {
  id: string;
  name: string;
  gradeLevel: number;
}

export interface ClassDto {
  id: string;
  name: string;
  joinCode: string | null; // only visible to the owning teacher
  archived: boolean;
  teacherName: string;
  studentCount: number;
  createdAt: string;
}

export interface QuestionDto {
  id: string;
  topicId: string;
  topicName: string;
  difficulty: number;
  type: QuestionType;
  body: string;
  options: string[] | null;
  correctAnswer: string;
  explanation: string;
  status: QuestionStatus;
  source: 'human' | 'ai';
}

/** What a student sees while answering: never includes the answer. */
export interface PracticeQuestionDto {
  id: string;
  topicName: string;
  difficulty: number;
  type: QuestionType;
  body: string;
  options: string[] | null;
}

export interface QuizDto {
  id: string;
  title: string;
  topicId: string;
  topicName: string;
  status: 'draft' | 'published';
  questionCount: number;
  createdAt: string;
}

export interface AssignmentDto {
  id: string;
  quizId: string;
  quizTitle: string;
  topicName: string;
  classId: string;
  className: string;
  dueAt: string;
  questionCount: number;
  completed: boolean;
  overdue: boolean;
}

export interface PracticeSessionDto {
  id: string;
  topicId: string;
  topicName: string;
  assignmentId: string | null;
  currentDifficulty: number;
  answeredCount: number;
  correctCount: number;
  totalQuestions: number;
  completed: boolean;
  startedAt: string;
}

export interface NextQuestionResponse {
  session: PracticeSessionDto;
  question: PracticeQuestionDto | null; // null when the session is complete
}

export interface AnswerResult {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  explanationSource: 'static' | 'ai';
  previousDifficulty: number;
  newDifficulty: number;
  session: PracticeSessionDto;
}

export interface TopicMasteryDto {
  topicId: string;
  topicName: string;
  score: number; // 0..1
  attempts: number;
}

export interface ProgressDto {
  studentId: string;
  displayName: string;
  mastery: TopicMasteryDto[];
  streakDays: number;
  totalAttempts: number;
  accuracy: number; // 0..1
  timeSpentMs: number;
  trend: { date: string; attempts: number; accuracy: number }[];
}

export interface AttemptDto {
  id: string;
  questionId: string;
  questionBody: string;
  topicName: string;
  answer: string;
  correctAnswer: string;
  correct: boolean;
  difficulty: number;
  timeMs: number;
  createdAt: string;
}

export interface ClassSummaryDto {
  classId: string;
  className: string;
  studentCount: number;
  averageScore: number; // 0..1, accuracy across enrolled students
  completionRate: number; // 0..1, completed assignment targets / all targets
  weakestTopics: { topicId: string; topicName: string; averageMastery: number }[];
  studentsAtRisk: { studentId: string; displayName: string; reasons: string[] }[];
  students: {
    studentId: string;
    displayName: string;
    accuracy: number;
    attempts: number;
    overdueCount: number;
  }[];
  assignments: {
    id: string;
    quizTitle: string;
    dueAt: string;
    completed: number;
    total: number;
  }[];
}

export interface AuditLogDto {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  target: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
