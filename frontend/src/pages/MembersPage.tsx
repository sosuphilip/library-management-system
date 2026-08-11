import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import type { MemberListItem, Paginated } from '../lib/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Pagination,
  Select
} from '../components/ui';
import { formatDate, fullName } from '../lib/format';

const PAGE_SIZE = 15;

export default function MembersPage() {
  const queryClient = useQueryClient();
  const [flash, setFlash] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
  if (q) params.set('q', q);
  if (status) params.set('status', status);

  const membersQuery = useQuery({
    queryKey: ['members', q, status, page],
    queryFn: () => api<Paginated<MemberListItem>>(`/members?${params}`)
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['members'] });

  const suspend = useMutation({
    mutationFn: (id: string) => api(`/members/${id}/suspend`, { method: 'POST', body: {} }),
    onSuccess: () => {
      setFlash({ kind: 'success', text: 'Member suspended.' });
      invalidate();
    },
    onError: (err) => setFlash({ kind: 'error', text: err instanceof ApiError ? err.message : 'Failed to suspend.' })
  });

  const reinstate = useMutation({
    mutationFn: (id: string) => api(`/members/${id}/reinstate`, { method: 'POST' }),
    onSuccess: () => {
      setFlash({ kind: 'success', text: 'Member reinstated.' });
      invalidate();
    },
    onError: (err) => setFlash({ kind: 'error', text: err instanceof ApiError ? err.message : 'Failed to reinstate.' })
  });

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  return (
    <div>
      <PageHeader title="Members" subtitle="Search members and manage account status" />

      {flash && (
        <div className="mb-4">
          <Alert kind={flash.kind}>{flash.text}</Alert>
        </div>
      )}

      <Card className="mb-6 p-4">
        <form onSubmit={onSearch} className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <Field label="Search" className="md:col-span-8">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or membership number…" />
          </Field>
          <Field label="Status" className="md:col-span-3">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </Select>
          </Field>
          <div className="flex items-end md:col-span-1">
            <Button type="submit" variant="secondary" className="w-full">
              Search
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        {membersQuery.isLoading ? (
          <LoadingBlock />
        ) : membersQuery.isError ? (
          <div className="p-5">
            <Alert>{membersQuery.error instanceof Error ? membersQuery.error.message : 'Failed to load members.'}</Alert>
          </div>
        ) : (membersQuery.data?.items ?? []).length === 0 ? (
          <EmptyState title="No members found" message="Try a different search or status filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Membership</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Joined</th>
                  <th className="px-5 py-3 text-right">Loans</th>
                  <th className="px-5 py-3 text-right">Unpaid fines</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {membersQuery.data?.items.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link to={`/members/${m.id}`} className="font-medium text-brand-700 hover:underline">
                        {fullName(m.firstName, m.lastName)}
                      </Link>
                      <p className="text-xs text-slate-400">{m.email}</p>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{m.membershipNumber}</td>
                    <td className="px-5 py-3">
                      <Badge status={m.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(m.createdAt)}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{m._count.loans}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{m._count.fines}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/members/${m.id}`}>
                          <Button variant="ghost">View</Button>
                        </Link>
                        {m.status === 'ACTIVE' ? (
                          <Button variant="secondary" onClick={() => suspend.mutate(m.id)}>
                            Suspend
                          </Button>
                        ) : (
                          <Button variant="secondary" onClick={() => reinstate.mutate(m.id)}>
                            Reinstate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={membersQuery.data?.pagination.page ?? 1}
          totalPages={membersQuery.data?.pagination.totalPages ?? 1}
          total={membersQuery.data?.pagination.total ?? 0}
          onPage={setPage}
          pageSizeLabel={`${membersQuery.data?.items.length ?? 0} members`}
        />
      </Card>
    </div>
  );
}
