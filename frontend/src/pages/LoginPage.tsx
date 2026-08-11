import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import { Alert, Button, Card, Field, Input } from '../components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="text-4xl" aria-hidden>📚</span>
          <h1 className="mt-2 text-xl font-bold text-slate-800">Library Management System</h1>
          <p className="text-sm text-slate-500">Sign in to continue</p>
        </div>

        <Card className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
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
            <Button type="submit" loading={submitting} className="w-full">
              Sign in
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            New member?{' '}
            <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
              Create an account
            </Link>
          </p>
        </Card>

        <p className="mt-4 text-center text-xs text-slate-400">
          Demo — Admin: admin@library.local · Staff: librarian@library.local · Member: ada.lovelace@example.com
          <br />
          Password for all: Passw0rd!
        </p>
      </div>
    </div>
  );
}
