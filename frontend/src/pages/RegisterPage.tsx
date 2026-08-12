import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import { Alert, Button, Card, Field, Input } from '../components/ui';
import { ThemeToggle } from '../components/ThemeToggle';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form);
      navigate('/my', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create your account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-100 to-brand-100 px-4 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950">
      <ThemeToggle className="absolute right-4 top-4 rounded-lg border border-slate-300 bg-white/80 p-2 text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white" />
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-3xl shadow-md" aria-hidden>
            📚
          </span>
          <h1 className="mt-3 text-xl font-bold text-slate-800 dark:text-slate-100">Join the Library</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Create a membership account</p>
        </div>

        <Card className="p-6 shadow-xl">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <Input required autoComplete="given-name" value={form.firstName} onChange={set('firstName')} />
              </Field>
              <Field label="Last name">
                <Input required autoComplete="family-name" value={form.lastName} onChange={set('lastName')} />
              </Field>
            </div>
            <Field label="Email">
              <Input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={set('email')}
                placeholder="you@example.com"
              />
            </Field>
            <Field
              label="Password"
              hint="At least 8 characters with an uppercase letter, a lowercase letter and a number."
            >
              <Input
                type="password"
                required
                autoComplete="new-password"
                value={form.password}
                onChange={set('password')}
              />
            </Field>
            <Button type="submit" loading={submitting} className="w-full">
              Create account
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
