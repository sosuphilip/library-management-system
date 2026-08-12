import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, clearTokens } from '../lib/api';
import type { Fine, Loan, Notification, Reservation } from '../lib/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Select
} from '../components/ui';
import { daysUntil, formatDate, formatDateTime, formatMoney, plural } from '../lib/format';

export default function MyAccountPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [flash, setFlash] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const loans = useQuery({
    queryKey: ['me', 'loans'],
    queryFn: () => api<{ loans: Loan[] }>('/circulation/me/loans')
  });
  const reservations = useQuery({
    queryKey: ['me', 'reservations'],
    queryFn: () => api<{ reservations: Reservation[] }>('/circulation/me/reservations')
  });
  const fines = useQuery({
    queryKey: ['me', 'fines'],
    queryFn: () => api<{ fines: Fine[] }>('/circulation/me/fines')
  });
  const notifications = useQuery({
    queryKey: ['me', 'notifications'],
    queryFn: () => api<{ notifications: Notification[] }>('/notifications/me')
  });

  const invalidate = () => {
    for (const key of ['me', 'book', 'catalog']) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const renew = useMutation({
    mutationFn: (loanId: string) => api(`/circulation/loans/${loanId}/renew`, { method: 'POST' }),
    onSuccess: () => {
      setFlash({ kind: 'success', text: 'Loan renewed.' });
      invalidate();
    },
    onError: (err) => setFlash({ kind: 'error', text: err instanceof ApiError ? err.message : 'Renewal failed.' })
  });

  const cancelHold = useMutation({
    mutationFn: (reservationId: string) => api(`/circulation/reservations/${reservationId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
    onError: (err) => setFlash({ kind: 'error', text: err instanceof ApiError ? err.message : 'Could not cancel the hold.' })
  });

  const markRead = useMutation({
    mutationFn: (notificationId: string) =>
      api(`/notifications/me/${notificationId}/read`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['me'] })
  });

  const markAllRead = useMutation({
    mutationFn: () => api('/notifications/me/read-all', { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['me'] })
  });

  if (loans.isLoading || reservations.isLoading || fines.isLoading || notifications.isLoading) {
    return <LoadingBlock />;
  }

  const activeLoans = (loans.data?.loans ?? []).filter((l) => l.status === 'ACTIVE');
  const unread = (notifications.data?.notifications ?? []).filter((n) => !n.readAt).length;

  return (
    <div>
      <PageHeader
        title="My Account"
        subtitle={
          <span>
            {plural(activeLoans.length, 'active loan')} · {plural(unread, 'unread notification')}
          </span>
        }
      />

      {flash && (
        <div className="mb-4">
          <Alert kind={flash.kind}>{flash.text}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Loans */}
        <Card>
          <CardHeader title="Loans" subtitle="Books you currently have checked out" />
          {activeLoans.length === 0 ? (
            <EmptyState title="No active loans" message="Browse the catalog to borrow a book." action={<Link to="/catalog"><Button variant="secondary">Browse catalog</Button></Link>} />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {activeLoans.map((loan) => {
                const overdue = daysUntil(loan.dueDate) < 0;
                return (
                  <li key={loan.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        {loan.copy?.book.title ?? 'Book'}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {loan.copy?.barcode} · {overdue ? 'overdue' : 'due'} {formatDate(loan.dueDate)}
                        {overdue && <> ({Math.abs(daysUntil(loan.dueDate))} days)</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge status={overdue ? 'OVERDUE' : 'ACTIVE_LOAN'} />
                      <Button
                        variant="secondary"
                        disabled={loan.renewals >= loan.maxRenewals}
                        onClick={() => renew.mutate(loan.id)}
                      >
                        Renew ({loan.renewals}/{loan.maxRenewals})
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Holds */}
        <Card>
          <CardHeader title="Holds" subtitle="Reservations on books" />
          {(reservations.data?.reservations ?? []).length === 0 ? (
            <EmptyState title="No holds" message="Reserve a book from its catalog page." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {(reservations.data?.reservations ?? []).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{r.book?.title ?? 'Book'}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Position {r.position} · placed {formatDate(r.createdAt)}
                      {r.expiresAt && <> · expires {formatDate(r.expiresAt)}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={r.status} />
                    {r.status === 'WAITING' && (
                      <Button variant="ghost" onClick={() => cancelHold.mutate(r.id)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Fines */}
        <Card>
          <CardHeader title="Fines" subtitle="Unpaid balances and payment history" />
          {(fines.data?.fines ?? []).length === 0 ? (
            <EmptyState title="No fines" message="You're all clear." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {(fines.data?.fines ?? []).map((fine) => (
                <FineRow key={fine.id} fine={fine} onPaid={invalidate} />
              ))}
            </ul>
          )}
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader
            title="Notifications"
            subtitle={`${unread} unread`}
            actions={
              unread > 0 ? (
                <Button variant="secondary" loading={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
                  Mark all read
                </Button>
              ) : undefined
            }
          />
          {(notifications.data?.notifications ?? []).length === 0 ? (
            <EmptyState title="No notifications" message="You'll hear about holds and due dates here." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {(notifications.data?.notifications ?? []).slice(0, 10).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => n.readAt || markRead.mutate(n.id)}
                    className={`block w-full px-5 py-3 text-left transition-colors ${
                      n.readAt ? '' : 'hover:bg-brand-50/60 dark:hover:bg-brand-900/30'
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {n.title}
                      {!n.readAt && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-brand-500" />}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{n.body}</p>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{formatDateTime(n.createdAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Change password */}
      <ChangePasswordCard onChanged={() => navigate('/login', { state: { notice: 'Password changed. Sign in with your new password.' } })} />
    </div>
  );
}

function ChangePasswordCard({ onChanged }: { onChanged: () => void }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const change = useMutation({
    mutationFn: () =>
      api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword }
      }),
    onSuccess: () => {
      // Backend revokes all sessions on password change — drop local tokens
      // and hand off to the login page with a notice.
      clearTokens();
      onChanged();
    },
    onError: (err) => {
      setSuccess('');
      setError(err instanceof ApiError ? err.message : 'Could not change your password.');
    }
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const pw = form.newPassword;
    if (pw.length < 8 || !/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) {
      setError('New password must be at least 8 characters with an uppercase letter, a lowercase letter and a number.');
      return;
    }
    if (pw !== form.confirm) {
      setError('New passwords do not match.');
      return;
    }
    change.mutate();
  }

  return (
    <Card className="mt-6">
      <CardHeader title="Change password" subtitle="You'll be signed out everywhere after changing it" />
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
        {error && <Alert className="sm:col-span-3">{error}</Alert>}
        {success && <Alert kind="success" className="sm:col-span-3">{success}</Alert>}
        <Field label="Current password">
          <Input
            type="password"
            required
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
          />
        </Field>
        <Field label="New password" hint="8+ chars, upper, lower, number">
          <Input
            type="password"
            required
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
          />
        </Field>
        <Field label="Confirm new password">
          <Input
            type="password"
            required
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
          />
        </Field>
        <div className="sm:col-span-3">
          <Button type="submit" loading={change.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}

function FineRow({ fine, onPaid }: { fine: Fine; onPaid: () => void }) {
  const [amount, setAmount] = useState(Number(fine.balance));
  const [method, setMethod] = useState('CASH');
  const [error, setError] = useState('');

  const pay = useMutation({
    mutationFn: () =>
      api('/circulation/fines/pay', { method: 'POST', body: { fineId: fine.id, amount, method } }),
    onSuccess: onPaid,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Payment failed.')
  });

  const balance = Number(fine.balance);

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {fine.loan?.copy?.book.title ?? 'Fine'} · {formatMoney(fine.amount)}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {fine.reason ?? 'No reason'} · {formatDate(fine.createdAt)}
          </p>
        </div>
        <Badge status={fine.status} />
      </div>

      {fine.status === 'UNPAID' && balance > 0 && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2 rounded bg-slate-50 p-3 dark:bg-slate-900/60"
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            pay.mutate();
          }}
        >
          <Field label="Amount" className="w-32">
            <Input type="number" min={0.01} step={0.01} max={balance} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Field label="Method" className="w-32">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="ONLINE">Online</option>
            </Select>
          </Field>
          <Button type="submit" loading={pay.isPending}>
            Pay {formatMoney(amount)}
          </Button>
          <p className="w-full text-xs text-slate-400 dark:text-slate-500">Balance: {formatMoney(balance)}</p>
          {error && <p className="w-full text-xs text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}
    </li>
  );
}
