import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import { Alert, Button, Card, Field, Input } from '../components/ui';
import { Icon } from '../components/icons';
import { ThemeToggle } from '../components/ThemeToggle';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'MEMBER' ? '/my' : '/catalog', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-paper via-paper to-brand-100/80 px-4 dark:from-brand-950 dark:via-brand-950 dark:to-brand-900">
      <ThemeToggle className="absolute right-4 top-4 rounded-lg border border-slate-300 bg-white/80 p-2 text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white" />
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-md ring-1 ring-white/10" aria-hidden>
            <Icon name="library" className="h-7 w-7" />
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-800 dark:text-stone-100">
            Library Management System
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in to continue</p>
        </div>

        <Card className="p-6 shadow-xl">
          <form onSubmit={onSubmit} className="space-y-4">
            {notice && <Alert kind="success">{notice}</Alert>}
            {error && <Alert>{error}</Alert>}
            <Field label="Email">
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                Forgot password?
              </Link>
            </div>
            <Button type="submit" loading={submitting} className="w-full">
              Sign in
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            New member?{' '}
            <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
              Create an account
            </Link>
          </p>
        </Card>

        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          Demo — Admin: admin@library.local · Staff: librarian@library.local · Member: ada.lovelace@example.com
          <br />
          Password for all: Passw0rd!
        </p>
      </div>
    </div>
  );
}
