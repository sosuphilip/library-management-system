import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import type { Loan, Paginated } from '../lib/types';
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
  Pagination,
  Select
} from '../components/ui';
import { daysUntil, formatDate, formatDateTime, fullName } from '../lib/format';

const PAGE_SIZE = 15;

export default function CirculationPage() {
  const queryClient = useQueryClient();
  const [flash, setFlash] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [returnCopyId, setReturnCopyId] = useState('');

  const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
  if (status) params.set('status', status);

  const loansQuery = useQuery({
    queryKey: ['loans', status, page],
    queryFn: () => api<Paginated<Loan>>(`/circulation/loans?${params}`)
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['loans'] });
    void queryClient.invalidateQueries({ queryKey: ['book'] });
  };

  const renew = useMutation({
    mutationFn: (loanId: string) => api(`/circulation/loans/${loanId}/renew`, { method: 'POST' }),
    onSuccess: () => {
      setFlash({ kind: 'success', text: 'Loan renewed.' });
      invalidate();
    },
    onError: (err) => setFlash({ kind: 'error', text: err instanceof ApiError ? err.message : 'Renewal failed.' })
  });

  const returnLoan = useMutation({
    mutationFn: () => api('/circulation/returns', { method: 'POST', body: { copyId: returnCopyId } }),
    onSuccess: () => {
      setFlash({ kind: 'success', text: 'Copy checked in.' });
      setReturnCopyId('');
      invalidate();
    },
    onError: (err) => setFlash({ kind: 'error', text: err instanceof ApiError ? err.message : 'Check-in failed.' })
  });

  function onReturn(e: FormEvent) {
    e.preventDefault();
    setFlash(null);
    returnLoan.mutate();
  }

  return (
    <div>
      <PageHeader
        title="Circulation"
        subtitle="Track loans, renew and check in copies"
        actions={
          <Link to="/catalog">
            <Button variant="secondary">Check out from catalog →</Button>
          </Link>
        }
      />

      {flash && (
        <div className="mb-4">
          <Alert kind={flash.kind}>{flash.text}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Check-in */}
        <Card className="lg:col-span-1">
          <CardHeader title="Check in a copy" subtitle="Enter the copy ID shown on a book's page" />
          <form onSubmit={onReturn} className="space-y-3 p-5">
            <Field label="Copy ID">
              <Input
                required
                value={returnCopyId}
                onChange={(e) => setReturnCopyId(e.target.value)}
                placeholder="e.g. 3f2a…-…-…"
              />
            </Field>
            <Button type="submit" loading={returnLoan.isPending} className="w-full">
              Check in
            </Button>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Late returns automatically accrue fines at the configured daily rate.
            </p>
          </form>
        </Card>

        {/* Loan list */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Loans"
            actions={
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="w-40"
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="RETURNED">Returned</option>
                <option value="LOST">Lost</option>
              </Select>
            }
          />

          {loansQuery.isLoading ? (
            <LoadingBlock />
          ) : loansQuery.isError ? (
            <div className="p-5">
              <Alert>{loansQuery.error instanceof Error ? loansQuery.error.message : 'Failed to load loans.'}</Alert>
            </div>
          ) : (loansQuery.data?.items ?? []).length === 0 ? (
            <EmptyState title="No loans" message="Loans will appear here once members check out books." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {loansQuery.data?.items.map((loan) => {
                const overdue = loan.status === 'ACTIVE' && daysUntil(loan.dueDate) < 0;
                return (
                  <li key={loan.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        <Link to={`/catalog/${loan.bookId}`} className="hover:text-brand-700 dark:hover:text-brand-300">
                          {loan.copy?.book.title ?? 'Book'}
                        </Link>
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {loan.user ? fullName(loan.user.firstName, loan.user.lastName) : '—'} · {loan.copy?.barcode} · checked
                        out {formatDateTime(loan.checkedOutAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {overdue && <Badge status="OVERDUE" />}
                      <Badge status={loan.status} />
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {loan.status === 'RETURNED'
                          ? `returned ${formatDate(loan.returnedAt)}`
                          : `due ${formatDate(loan.dueDate)}`}
                      </span>
                      {loan.status === 'ACTIVE' && (
                        <Button
                          variant="secondary"
                          disabled={loan.renewals >= loan.maxRenewals}
                          onClick={() => renew.mutate(loan.id)}
                        >
                          Renew
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination
            page={loansQuery.data?.pagination.page ?? 1}
            totalPages={loansQuery.data?.pagination.totalPages ?? 1}
            total={loansQuery.data?.pagination.total ?? 0}
            onPage={setPage}
            pageSizeLabel={`${loansQuery.data?.items.length ?? 0} loans`}
          />
        </Card>
      </div>
    </div>
  );
}
