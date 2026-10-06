import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PASSWORD_MIN_LENGTH, registerSchema } from '@learnloop/shared';
import { Alert, Button, Input, cx } from '../../components/ui';
import { ApiRequestError, errorMessage } from '../../lib/api';
import { homeFor, useAuth } from '../../lib/auth';
import { AuthShell } from './AuthShell';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    role: 'student' as 'student' | 'teacher',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    setError(null);
    try {
      const user = await register(parsed.data);
      navigate(homeFor(user.role), { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError && err.body.details) setErrors(err.fieldErrors());
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <AuthShell
      title="Create your account"
      subtitle="All demo data is synthetic. No real student records."
      footer={
        <>
          Already have an account?{' '}
          <Link className="font-medium text-brand-700 hover:underline" to="/login">
            Log in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink">I am a</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['student', 'teacher'] as const).map((r) => (
              <label
                key={r}
                className={cx(
                  'flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium capitalize',
                  form.role === r
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-line text-ink-muted',
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={form.role === r}
                  onChange={set('role')}
                  className="sr-only"
                />
                {r}
              </label>
            ))}
          </div>
        </fieldset>
        <Input
          label="Name"
          autoComplete="name"
          value={form.displayName}
          onChange={set('displayName')}
          error={errors.displayName}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          error={errors.email}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters. A short phrase works well.`}
        />
        <Button type="submit" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
