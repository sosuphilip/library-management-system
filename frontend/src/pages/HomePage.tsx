import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { DashboardStats, Loan } from '../lib/types';
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
import { formatDateTime, formatMoney, fullName } from '../lib/format';

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingBlock />;
  // Members keep their personal hub as the landing page.
  if (!user || user.role === 'MEMBER') return <Navigate to={user ? '/my' : '/login'} replace />;

  return <StaffDashboard />;
}

function StaffDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const statsQuery = useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: () => api<{ stats: DashboardStats }>('/reports/dashboard')
  });
  const checkoutsQuery = useQuery({
    queryKey: ['reports', 'recent-checkouts'],
    queryFn: () => api<{ loans: Loan[] }>('/reports/recent-checkouts')
  });

  if (statsQuery.isLoading || checkoutsQuery.isLoading) return <LoadingBlock />;
  if (statsQuery.isError || checkoutsQuery.isError) {
    return <Alert>Failed to load the dashboard.</Alert>;
  }

  const stats = statsQuery.data!.stats;
  const recent = checkoutsQuery.data?.loans ?? [];

  const quickActions = [
    { to: '/catalog/new', label: 'Add a book', icon: '➕' },
    { to: '/circulation', label: 'Check in / check out', icon: '🔁' },
    { to: '/members', label: 'Manage members', icon: '👥' },
    { to: '/reports', label: 'View reports & exports', icon: '📊' },
    ...(isAdmin
      ? [
          { to: '/admin/audit', label: 'Browse audit log', icon: '🧾' },
          { to: '/admin/templates', label: 'Edit email templates', icon: '✉️' }
        ]
      : [])
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.firstName ?? 'there'} 👋`}
        subtitle="Here's what's happening at the library today"
      />

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent checkouts */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent checkouts"
            subtitle="Latest activity"
            actions={
              <Link to="/circulation">
                <Button variant="secondary">All loans →</Button>
              </Link>
            }
          />
          {recent.length === 0 ? (
            <EmptyState title="No checkouts yet" message="Loans will appear here once members borrow books." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {recent.map((loan) => (
                <li key={loan.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <Link
                      to={`/catalog/${loan.bookId}`}
                      className="truncate text-sm font-medium text-slate-800 hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
                    >
                      {loan.copy?.book.title ?? 'Book'}
                    </Link>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {loan.user ? fullName(loan.user.firstName, loan.user.lastName) : '—'} · {loan.copy?.barcode}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge status={loan.status} />
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(loan.checkedOutAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader title="Quick actions" />
          <div className="flex flex-col gap-2 p-5">
            {quickActions.map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:text-brand-300"
              >
                <span aria-hidden className="text-lg transition-transform duration-150 group-hover:scale-110">
                  {a.icon}
                </span>
                {a.label}
                <span aria-hidden className="ml-auto text-slate-300 transition-transform duration-150 group-hover:translate-x-0.5 dark:text-slate-600">
                  →
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}`}>
        {value}
      </p>
    </Card>
  );
}
