import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Alert, Button, Card, Field, Input } from '../components/ui';
import { ThemeToggle } from '../components/ThemeToggle';

const PASSWORD_HINT = 'At least 8 characters with an uppercase letter, a lowercase letter and a number.';

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-z]/.test(pw)) return 'Password must contain a lowercase letter.';
  if (!/[A-Z]/.test(pw)) return 'Password must contain an uppercase letter.';
  if (!/[0-9]/.test(pw)) return 'Password must contain a number.';
  return null;
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const problem = validatePassword(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api('/auth/password-reset/confirm', { method: 'POST', body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset your password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-100 to-brand-100 px-4 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950">
      <ThemeToggle className="absolute right-4 top-4 rounded-lg border border-slate-300 bg-white/80 p-2 text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white" />
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-3xl shadow-md"
            aria-hidden
          >
            🔑
          </span>
          <h1 className="mt-3 text-xl font-bold text-slate-800 dark:text-slate-100">Choose a new password</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">All your devices will be signed out.</p>
        </div>

        <Card className="p-6 shadow-xl">
          {!token ? (
            <div className="space-y-4">
              <Alert>This reset link is missing its token. It may be truncated — try opening the link from the email again.</Alert>
              <Link to="/forgot-password" className="block">
                <Button variant="secondary" className="w-full">
                  Request a new link
                </Button>
              </Link>
            </div>
          ) : done ? (
            <div className="space-y-4 text-center">
              <Alert kind="success">Your password has been reset. You can sign in with the new one now.</Alert>
              <Link to="/login" className="block">
                <Button className="w-full">Go to sign in</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {error && <Alert>{error}</Alert>}
              <Field label="New password" hint={PASSWORD_HINT}>
                <Input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Field label="Confirm new password">
                <Input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>
              <Button type="submit" loading={submitting} className="w-full">
                Set new password
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
