import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import { Alert, Button, Card, Field, Input } from '../components/ui';

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="text-4xl" aria-hidden>📚</span>
          <h1 className="mt-2 text-xl font-bold text-slate-800">Join the Library</h1>
          <p className="text-sm text-slate-500">Create a membership account</p>
        </div>

        <Card className="p-6">
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
            <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
