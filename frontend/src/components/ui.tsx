import { useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ImgHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { statusClass } from '../lib/format';
import { Icon } from './icons';

// ---------------------------------------------------------------
// Button
// ---------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 hover:shadow-md active:scale-[0.98]',
    secondary:
      'border border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50 hover:shadow-md active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700 dark:hover:text-white',
    accent: 'bg-brass-700 text-white shadow-sm hover:bg-brass-800 hover:shadow-md active:scale-[0.98]',
    danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md active:scale-[0.98]',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
  };
  return (
    <button className={clsx(base, variants[variant], className)} disabled={disabled || loading} {...rest}>
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------

const controlCls =
  'block w-full rounded-md border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-700/60 dark:disabled:text-slate-500 dark:[&>option]:bg-slate-800';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(controlCls, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(controlCls, className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(controlCls, className)} {...rest} />;
}

export function Field({
  label,
  error,
  hint,
  children,
  className
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}

// ---------------------------------------------------------------
// Card
// ---------------------------------------------------------------

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        'rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-800',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-stone-800 dark:text-stone-100">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

// ---------------------------------------------------------------
// Book cover (with gradient fallback for missing / broken images)
// ---------------------------------------------------------------

interface CoverImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  title: string;
  src?: string | null;
}

/** Renders a book cover, falling back to a brand-gradient tile with the first
 *  letter when the URL is missing or the image fails to load (e.g. an ISBN not
 *  in the cover provider). */
export function CoverImage({ title, className, src, ...rest }: CoverImageProps) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div
        aria-hidden
        className={clsx(
          'flex select-none items-center justify-center bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 text-white',
          className
        )}
      >
        <span className="text-3xl font-bold drop-shadow-sm">{title.charAt(0).toUpperCase()}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className={clsx('object-cover', className)}
      {...rest}
    />
  );
}

// ---------------------------------------------------------------
// Badge / status pill
// ---------------------------------------------------------------

export function Badge({ status, children }: { status?: string; children?: ReactNode }) {
  const label = children ?? status;
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        statusClass(status ?? '')
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------
// Alerts & spinner
// ---------------------------------------------------------------

export function Alert({
  kind = 'error',
  children,
  className
}: {
  kind?: 'error' | 'success' | 'info';
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    error:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300',
    success:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300',
    info: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/50 dark:text-sky-300'
  };
  return (
    <div className={clsx('rounded-md border px-4 py-3 text-sm', styles[kind], className)} role="alert">
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('animate-spin text-current', className ?? 'h-5 w-5')}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 dark:text-slate-500">
      <Spinner />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300">
        <Icon name="book" className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      {message && <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-800 dark:text-stone-100">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
  pageSizeLabel
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
  pageSizeLabel: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 dark:border-slate-700">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {pageSizeLabel} · <span className="font-medium text-slate-700 dark:text-slate-300">{total}</span> total
      </p>
      <div className="flex items-center gap-1">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span className="px-2 text-sm text-slate-600 dark:text-slate-400">
          {page} / {totalPages}
        </span>
        <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
