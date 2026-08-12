/** Shared display helpers. */

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/** Money: backends send Prisma Decimals as strings. */
export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  // Pin the locale so output is deterministic across environments (Node's
  // generic `en` locale renders USD as "US$2.50").
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** Whole days between now and a date; negative → past. */
export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function fullName(first: string, last: string): string {
  return `${first} ${last}`.trim();
}

/** Status pill colors shared across the app. */
export function statusClass(status: string): string {
  switch (status.toUpperCase()) {
    case 'AVAILABLE':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'; // amber = available / reserve moments
    case 'ACTIVE':
    case 'PAID':
    case 'READY':
    case 'FULFILLED':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300';
    case 'SUSPENDED':
    case 'OVERDUE':
    case 'EXPIRED':
    case 'LOST':
      return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
    case 'CHECKED_OUT':
    case 'ACTIVE_LOAN':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300';
    case 'WAITING':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300';
    case 'WAIVED':
    case 'RETURNED':
    case 'CANCELLED':
      return 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
    case 'UNPAID':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300';
    case 'DAMAGED':
    case 'IN_REPAIR':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
  }
}

export function initial(name: string): string {
  return (name.trim().charAt(0) || '?').toUpperCase();
}
