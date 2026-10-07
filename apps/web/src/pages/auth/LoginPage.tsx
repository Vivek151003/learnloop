import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap, ShieldCheck, Users } from 'lucide-react';
import { loginSchema } from '@learnloop/shared';
import { Alert, Button, Input } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { homeFor, useAuth } from '../../lib/auth';
import { AuthShell } from './AuthShell';

const DEMO = [
  { role: 'Student', email: 'student2@learnloop.dev', icon: GraduationCap },
  { role: 'Teacher', email: 'teacher1@learnloop.dev', icon: Users },
  { role: 'Admin', email: 'admin@learnloop.dev', icon: ShieldCheck },
];
const DEMO_PASSWORD = 'LearnLoop!2026';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(credentials: { email: string; password: string }) {
    const parsed = loginSchema.safeParse(credentials);
    if (!parsed.success) {
      setError('Enter a valid email and your password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await login(parsed.data);
      navigate(from && from !== '/login' ? from : homeFor(user.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void signIn({ email, password });
  };

  return (
    <AuthShell
      title="Log in"
      subtitle="Enter your email and password to continue."
      footer={
        <>
          Don’t have an account?{' '}
          <Link className="font-medium text-brand-700 hover:underline" to="/register">
            Sign up
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@school.org"
        />
        <div>
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="mt-2 text-right">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Log in
        </Button>
      </form>

      <div className="relative my-7">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-200" />
        </div>
        <p className="relative mx-auto w-fit bg-white px-3 text-sm text-gray-500">
          Or try a demo account
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {DEMO.map(({ role, email: demoEmail, icon }) => (
          <Button
            key={role}
            type="button"
            variant="secondary"
            icon={icon}
            disabled={busy}
            onClick={() => void signIn({ email: demoEmail, password: DEMO_PASSWORD })}
          >
            {role}
          </Button>
        ))}
      </div>
    </AuthShell>
  );
}
