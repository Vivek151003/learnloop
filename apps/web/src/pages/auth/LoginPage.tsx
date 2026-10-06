import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loginSchema } from '@learnloop/shared';
import { Alert, Button, Input } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { homeFor, useAuth } from '../../lib/auth';
import { AuthShell } from './AuthShell';

const DEMO = [
  { role: 'Student', email: 'student2@learnloop.dev' },
  { role: 'Teacher', email: 'teacher1@learnloop.dev' },
  { role: 'Admin', email: 'admin@learnloop.dev' },
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
      subtitle="Pick up where you left off."
      footer={
        <>
          No account yet?{' '}
          <Link className="link" to="/register">
            Create one
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="wrong">{error}</Alert>}
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="-mt-1 flex justify-end">
          <Link to="/forgot-password" className="link text-sm">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={busy}>
          Log in
        </Button>
      </form>
      <div className="mt-8 border-t border-rule pt-6">
        <p className="eyebrow">Or look around as</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {DEMO.map((d) => (
            <Button
              key={d.role}
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void signIn({ email: d.email, password: DEMO_PASSWORD })}
            >
              {d.role}
            </Button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}
