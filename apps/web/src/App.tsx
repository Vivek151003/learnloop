import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { GuestOnly, HomeRedirect, RequireRole } from './components/guards';
import { LoadingBlock } from './components/ui';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/auth/PasswordPages';
import { StudentHome } from './pages/student/StudentHome';
import { PracticePage } from './pages/student/PracticePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';

// Teacher and admin screens (and the chart library) load on demand, which keeps the
// student bundle small (NFR-8).
const ProgressPage = lazy(() => import('./pages/student/ProgressPage'));
const TeacherClasses = lazy(() => import('./pages/teacher/ClassesPage'));
const ClassDashboard = lazy(() => import('./pages/teacher/ClassDashboard'));
const StudentDetail = lazy(() => import('./pages/teacher/StudentDetail'));
const QuestionBank = lazy(() => import('./pages/teacher/QuestionBank'));
const QuizzesPage = lazy(() => import('./pages/teacher/QuizzesPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const AuditPage = lazy(() => import('./pages/admin/AuditPage'));

export function App() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-8">
          <LoadingBlock />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<RequireRole />}>
          <Route element={<Layout />}>
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>
        <Route element={<RequireRole roles={['student']} />}>
          <Route element={<Layout />}>
            <Route path="/student" element={<StudentHome />} />
            <Route path="/student/practice/:sessionId" element={<PracticePage />} />
            <Route path="/student/progress" element={<ProgressPage />} />
          </Route>
        </Route>
        <Route element={<RequireRole roles={['teacher', 'admin']} />}>
          <Route element={<Layout />}>
            <Route path="/teacher" element={<TeacherClasses />} />
            <Route path="/teacher/classes/:id" element={<ClassDashboard />} />
            <Route path="/teacher/students/:id" element={<StudentDetail />} />
            <Route path="/teacher/questions" element={<QuestionBank />} />
            <Route path="/teacher/quizzes" element={<QuizzesPage />} />
          </Route>
        </Route>
        <Route element={<RequireRole roles={['admin']} />}>
          <Route element={<Layout />}>
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/audit" element={<AuditPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
