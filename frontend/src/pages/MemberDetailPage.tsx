import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import type { Fine, MemberDossier } from '../lib/types';
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
  PageHeader
} from '../components/ui';
import { daysUntil, formatDate, formatMoney, fullName, plural } from '../lib/format';

export default function MemberDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [flash, setFlash] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const dossier = useQuery({
    queryKey: ['member', id],
    queryFn: () => api<MemberDossier>(`/members/${id}`)
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['member', id] });
    void queryClient.invalidateQueries({ queryKey: ['members'] });
  };

  const suspend = useMutation({
    mutationFn: () => api(`/members/${id}/suspend`, { method: 'POST', body: {} }),
    onSuccess: () => {
      setFlash({ kind: 'success', text: 'Member suspended.' });
      invalidate();
    },
    onError: (err) => setFlash({ kind: 'error', text: err instanceof ApiError ? err.message : 'Failed to suspend.' })
  });

  const reinstate = useMutation({
    mutationFn: () => api(`/members/${id}/reinstate`, { method: 'POST' }),
    onSuccess: () => {
      setFlash({ kind: 'success', text: 'Member reinstated.' });
      invalidate();
    },
    onError: (err) => setFlash({ kind: 'error', text: err instanceof ApiError ? err.message : 'Failed to reinstate.' })
  });

  const renew = useMutation({
    mutationFn: (loanId: string) => api(`/circulation/loans/${loanId}/renew`, { method: 'POST' }),
    onSuccess: () => invalidate(),
    onError: (err) => setFlash({ kind: 'error', text: err instanceof ApiError ? err.message : 'Renewal failed.' })
  });

  if (dossier.isLoading) return <LoadingBlock />;
  if (dossier.isError || !dossier.data) {
    return <Alert>{dossier.error instanceof Error ? dossier.error.message : 'Member not found.'}</Alert>;
  }

  const { member, stats } = dossier.data;

  return (
    <div>
      <PageHeader
        title={fullName(member.firstName, member.lastName)}
        subtitle={
          <span>
            {member.email} · {member.membershipNumber}
          </span>
        }
        actions={
          <>
            <Link to="/members">
              <Button variant="secondary">← Members</Button>
            </Link>
            {member.status === 'ACTIVE' ? (
              <Button variant="secondary" onClick={() => suspend.mutate()}>
                Suspend
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => reinstate.mutate()}>
                Reinstate
              </Button>
            )}
          </>
        }
      />

      {flash && (
        <div className="mb-4">
          <Alert kind={flash.kind}>{flash.text}</Alert>
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <Badge status={member.status} />
        {member.suspendedUntil && (
          <span className="text-sm text-slate-500 dark:text-slate-400">suspended until {formatDate(member.suspendedUntil)}</span>
        )}
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total loans" value={stats.totalLoans} />
        <Stat label="Active loans" value={stats.activeLoans} />
        <Stat label="Overdue" value={stats.overdueLoans} accent={stats.overdueLoans > 0} />
        <Stat label="Unpaid fines" value={formatMoney(stats.unpaidFines)} accent={stats.unpaidFines > 0} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Active loans */}
        <Card>
          <CardHeader title="Active loans" subtitle={plural(stats.activeLoans, 'loan')} />
          {dossier.data.activeLoans.length === 0 ? (
            <EmptyState title="No active loans" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {dossier.data.activeLoans.map((loan) => {
                const overdue = daysUntil(loan.dueDate) < 0;
                return (
                  <li key={loan.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        <Link to={`/catalog/${loan.bookId}`} className="hover:text-brand-700 dark:hover:text-brand-300">
                          {loan.copy?.book.title}
                        </Link>
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {loan.copy?.barcode} · {overdue ? 'overdue' : 'due'} {formatDate(loan.dueDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {overdue && <Badge status="OVERDUE" />}
                      <Button
                        variant="secondary"
                        disabled={loan.renewals >= loan.maxRenewals}
                        onClick={() => renew.mutate(loan.id)}
                      >
                        Renew
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
          <CardHeader title="Holds" />
          {dossier.data.reservations.length === 0 ? (
            <EmptyState title="No holds" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {dossier.data.reservations.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{r.book?.title}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Position {r.position} · {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <Badge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* History */}
        <Card>
          <CardHeader title="Loan history" subtitle="Recent checkouts and returns" />
          {dossier.data.loanHistory.length === 0 ? (
            <EmptyState title="No history yet" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {dossier.data.loanHistory.slice(0, 10).map((loan) => (
                <li key={loan.id} className="flex items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{loan.copy?.book.title}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {loan.copy?.barcode} · checked out {formatDate(loan.checkedOutAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge status={loan.status} />
                    {loan.status === 'RETURNED' && (
                      <span className="text-xs text-slate-400 dark:text-slate-500">returned {formatDate(loan.returnedAt)}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Fines */}
        <Card>
          <CardHeader title="Fines" subtitle="Adjust or waive outstanding balances" />
          {dossier.data.fines.length === 0 ? (
            <EmptyState title="No fines" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {dossier.data.fines.map((fine) => (
                <FineRow key={fine.id} fine={fine} onAdjusted={invalidate} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}`}>{value}</p>
    </Card>
  );
}

function FineRow({ fine, onAdjusted }: { fine: Fine; onAdjusted: () => void }) {
  const [amount, setAmount] = useState(Number(fine.balance));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'none' | 'waive' | 'adjust'>('none');

  const adjust = useMutation({
    mutationFn: () => {
      const body: { reason: string; amount?: number } = { reason };
      if (mode === 'adjust') body.amount = amount;
      return api(`/members/fines/${fine.id}/adjust`, { method: 'POST', body });
    },
    onSuccess: () => {
      onAdjusted();
      setMode('none');
      setReason('');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Adjustment failed.')
  });

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {fine.loan?.copy?.book.title ?? 'Fine'} · {formatMoney(fine.amount)}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {fine.reason ?? 'No reason'} · balance {formatMoney(fine.balance)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge status={fine.status} />
          {fine.status === 'UNPAID' && (
            <>
              <Button variant="ghost" onClick={() => setMode(mode === 'waive' ? 'none' : 'waive')}>
                Waive
              </Button>
              <Button variant="ghost" onClick={() => setMode(mode === 'adjust' ? 'none' : 'adjust')}>
                Adjust
              </Button>
            </>
          )}
        </div>
      </div>

      {mode !== 'none' && fine.status === 'UNPAID' && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2 rounded bg-slate-50 p-3 dark:bg-slate-900/60"
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            adjust.mutate();
          }}
        >
          {mode === 'adjust' && (
            <Field label="Amount" className="w-32">
              <Input
                type="number"
                min={0.01}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </Field>
          )}
          <Field label="Reason" className="min-w-52 flex-1">
            <Input required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why?" />
          </Field>
          <Button type="submit" loading={adjust.isPending}>
            {mode === 'waive' ? 'Waive fine' : 'Apply adjustment'}
          </Button>
          {error && <p className="w-full text-xs text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}
    </li>
  );
}
