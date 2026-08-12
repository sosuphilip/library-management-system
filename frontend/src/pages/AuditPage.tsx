import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { AuditLogEntry, Paginated } from '../lib/types';
import {
  Alert,
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
import { formatDateTime, fullName } from '../lib/format';

const PAGE_SIZE = 20;

function summarizeMetadata(meta: Record<string, unknown> | null): string {
  if (!meta) return '—';
  try {
    return JSON.stringify(meta);
  } catch {
    return '—';
  }
}

export default function AuditPage() {
  const [action, setAction] = useState('');
  const [appliedAction, setAppliedAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);

  const entityTypesQuery = useQuery({
    queryKey: ['audit', 'entity-types'],
    queryFn: () => api<{ entityTypes: string[] }>('/admin/audit/entity-types')
  });

  const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
  if (appliedAction) params.set('action', appliedAction);
  if (entityType) params.set('entityType', entityType);

  const auditQuery = useQuery({
    queryKey: ['audit', appliedAction, entityType, page],
    queryFn: () => api<Paginated<AuditLogEntry>>(`/admin/audit?${params}`)
  });

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setAppliedAction(action.trim());
    setPage(1);
  }

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every action recorded in the system, newest first" />

      <Card className="mb-6 p-4">
        <form onSubmit={onSearch} className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <Field label="Action" className="md:col-span-6">
            <Input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="e.g. LOAN.CHECKOUT, FINE.WAIVE, USER.LOGIN…"
            />
          </Field>
          <Field label="Entity type" className="md:col-span-4">
            <Select value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}>
              <option value="">All types</option>
              {(entityTypesQuery.data?.entityTypes ?? []).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end md:col-span-2">
            <Button type="submit" variant="secondary" className="w-full">
              Filter
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        {auditQuery.isLoading ? (
          <LoadingBlock />
        ) : auditQuery.isError ? (
          <div className="p-5">
            <Alert>{auditQuery.error instanceof Error ? auditQuery.error.message : 'Failed to load the audit log.'}</Alert>
          </div>
        ) : (auditQuery.data?.items ?? []).length === 0 ? (
          <EmptyState title="No audit entries" message="Try clearing the filters or check back after some activity." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-400 dark:bg-slate-900/60 dark:text-slate-500">
                <tr>
                  <th className="px-5 py-3">When</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Entity</th>
                  <th className="px-5 py-3">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {auditQuery.data?.items.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500 dark:text-slate-400">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        {entry.actor ? fullName(entry.actor.firstName, entry.actor.lastName) : 'System'}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{entry.actor?.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{entry.entityType}</span>
                      {entry.entityId && (
                        <span className="ml-2 font-mono text-xs text-slate-400 dark:text-slate-500">
                          {entry.entityId.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs truncate px-5 py-3 font-mono text-xs text-slate-400 dark:text-slate-500">
                      {summarizeMetadata(entry.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={auditQuery.data?.pagination.page ?? 1}
          totalPages={auditQuery.data?.pagination.totalPages ?? 1}
          total={auditQuery.data?.pagination.total ?? 0}
          onPage={setPage}
          pageSizeLabel={`${auditQuery.data?.items.length ?? 0} entries`}
        />
      </Card>
    </div>
  );
}
