import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { MemberListItem, Paginated } from '../lib/types';
import { Input } from './ui';
import { fullName } from '../lib/format';

/**
 * Search-and-select for a member. Used for staff checkout. `onSelect` receives
 * the picked member; the caller clears selection via the `resetKey`.
 */
export function MemberPicker({
  onSelect,
  resetKey
}: {
  onSelect: (member: MemberListItem) => void;
  resetKey: string;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQ('');
    setOpen(false);
  }, [resetKey]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const search = useQuery({
    queryKey: ['member-search', q],
    queryFn: () => api<Paginated<MemberListItem>>(`/members?q=${encodeURIComponent(q)}&limit=8`),
    enabled: q.trim().length > 0
  });

  return (
    <div ref={boxRef} className="relative">
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search member by name, email or number…"
      />
      {open && q.trim().length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {search.isLoading ? (
            <p className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">Searching…</p>
          ) : (search.data?.items ?? []).length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">No members found</p>
          ) : (
            (search.data?.items ?? []).map((m) => (
              <button
                key={m.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-50 dark:hover:bg-brand-900/50"
                onClick={() => {
                  onSelect(m);
                  setQ('');
                  setOpen(false);
                }}
              >
                <span className="font-medium text-slate-800 dark:text-slate-100">{fullName(m.firstName, m.lastName)}</span>
                <span className="ml-2 text-slate-500 dark:text-slate-400">{m.email}</span>
                <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{m.membershipNumber}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
