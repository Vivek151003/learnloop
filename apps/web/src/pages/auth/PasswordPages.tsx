import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PASSWORD_MIN_LENGTH } from '@learnloop/shared';
import { Alert, Button, Input } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { AuthShell } from './AuthShell';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We’ll email you a link that works once, for 30 minutes."
      footer={
        <Link className="text-brand-700 hover:underline" to="/login">
          Back to log in
        </Link>
      }
    >
      {sent ? (
        <Alert tone="success">If an account exists for {email}, a reset link is on its way.</Alert>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" className="w-full" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Choose a new password"
      footer={
        <Link className="text-brand-700 hover:underline" to="/login">
          Back to log in
        </Link>
      }
    >
      {!token ? (
        <Alert tone="danger">This reset link is missing its token. Request a new one.</Alert>
      ) : done ? (
        <Alert tone="success">Your password has been changed. You can now log in.</Alert>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          />
          <Button type="submit" className="w-full" loading={busy}>
            Set password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
