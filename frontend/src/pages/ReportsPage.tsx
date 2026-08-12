import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError, apiUrl, getAccessToken } from '../lib/api';
import type { Book, DashboardStats, Loan } from '../lib/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  LoadingBlock,
  PageHeader
} from '../components/ui';
import { daysUntil, formatMoney, fullName } from '../lib/format';

const EXPORTS = [
  { kind: 'books', label: 'Books' },
  { kind: 'loans', label: 'Loans' },
  { kind: 'overdue', label: 'Overdue loans' },
  { kind: 'fines', label: 'Fines' },
  { kind: 'members', label: 'Members' }
] as const;

async function downloadCsv(kind: string) {
  const token = getAccessToken();
  const res = await fetch(`${apiUrl}/reports/export/${kind}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new ApiError(`Export failed (${res.status})`, res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `library-${kind}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);

  const dashboard = useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: () => api<{ stats: DashboardStats }>('/reports/dashboard')
  });
  const mostBorrowed = useQuery({
    queryKey: ['reports', 'most-borrowed'],
    queryFn: () => api<{ books: Book[] }>('/reports/most-borrowed?limit=8')
  });
  const overdue = useQuery({
    queryKey: ['reports', 'overdue'],
    queryFn: () => api<{ loans: Loan[] }>('/reports/overdue')
  });

  if (dashboard.isLoading || mostBorrowed.isLoading || overdue.isLoading) return <LoadingBlock />;
  if (dashboard.isError || mostBorrowed.isError || overdue.isError) {
    return <Alert>Failed to load reports.</Alert>;
  }

  const stats = dashboard.data!.stats;

  async function onExport(kind: string) {
    setExportError('');
    setExporting(kind);
    try {
      await downloadCsv(kind);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(null);
    }
  }

  return (
    <div>
      <PageHeader title="Reports & dashboard" subtitle="Library activity at a glance" />

      {exportError && (
        <div className="mb-4">
          <Alert>{exportError}</Alert>
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Books" value={stats.books} />
        <Stat label="Copies" value={stats.copies} />
        <Stat label="Active loans" value={stats.activeLoans} />
        <Stat label="Overdue loans" value={stats.overdueLoans} accent={stats.overdueLoans > 0} />
        <Stat label="Members" value={stats.members} />
        <Stat label="Outstanding fines" value={formatMoney(stats.outstandingFines)} accent={stats.outstandingFines > 0} />
        <Stat label="Collected" value={formatMoney(stats.collectedFines)} />
        <Stat label="Waived" value={formatMoney(stats.waivedFines)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Most borrowed */}
        <Card>
          <CardHeader title="Most borrowed books" />
          {(mostBorrowed.data?.books ?? []).length === 0 ? (
            <EmptyState title="No checkout data yet" />
          ) : (
            <ol className="divide-y divide-slate-100 dark:divide-slate-700">
              {mostBorrowed.data!.books.map((book, i) => (
                <li key={book.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-6 text-center text-sm font-semibold text-slate-400 dark:text-slate-500">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link to={`/catalog/${book.id}`} className="truncate text-sm font-medium text-slate-800 hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300">
                      {book.title}
                    </Link>
                    <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                      {book.authors.map((a) => a.author.name).join(', ')}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{book._count?.loans ?? 0} loans</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* Overdue */}
        <Card>
          <CardHeader title="Overdue loans" subtitle="Active loans past their due date" />
          {(overdue.data?.loans ?? []).length === 0 ? (
            <EmptyState title="Nothing overdue 🎉" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {overdue.data!.loans.map((loan) => (
                <li key={loan.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{loan.copy?.book.title}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {loan.user ? fullName(loan.user.firstName, loan.user.lastName) : '—'} · {loan.copy?.barcode}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status="OVERDUE" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {Math.abs(daysUntil(loan.dueDate))} days late
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Exports */}
      <Card className="mt-6">
        <CardHeader title="Export data" subtitle="Download CSV exports for offline analysis" />
        <div className="flex flex-wrap gap-2 p-5">
          {EXPORTS.map((e) => (
            <Button key={e.kind} variant="secondary" loading={exporting === e.kind} onClick={() => void onExport(e.kind)}>
              Export {e.label}
            </Button>
          ))}
        </div>
      </Card>
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
