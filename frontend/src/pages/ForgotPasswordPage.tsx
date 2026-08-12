import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Alert, Button, Card, Field, Input } from '../components/ui';
import { ThemeToggle } from '../components/ThemeToggle';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api('/auth/password-reset/request', { method: 'POST', body: { email } });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not request a reset link.');
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
          <h1 className="mt-3 text-xl font-bold text-slate-800 dark:text-slate-100">Reset your password</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {sent ? 'Check your inbox' : 'We’ll email you a reset link'}
          </p>
        </div>

        <Card className="p-6 shadow-xl">
          {sent ? (
            <div className="space-y-4 text-center">
              <Alert kind="success">
                If an account exists for <span className="font-medium">{email}</span>, a password reset link is on its
                way. The link expires in 60 minutes.
              </Alert>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Didn’t get it? Check your spam folder or{' '}
                <button type="button" onClick={() => setSent(false)} className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
                  try again
                </button>
                .
              </p>
              <Link to="/login" className="block">
                <Button variant="secondary" className="w-full">
                  ← Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {error && <Alert>{error}</Alert>}
              <Field label="Email" hint="We’ll send a one-time reset link to this address.">
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <Button type="submit" loading={submitting} className="w-full">
                Send reset link
              </Button>
            </form>
          )}

          <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Remembered it?{' '}
            <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
