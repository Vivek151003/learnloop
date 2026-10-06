import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../lib/api';

// The design system (NFR-1): every page builds from these pieces, so spacing,
// type, colour and states stay consistent across student, teacher and admin views.

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-200',
  secondary: 'bg-white text-ink border border-line hover:bg-surface-sunken disabled:text-ink-faint',
  ghost: 'text-brand-700 hover:bg-brand-50 disabled:text-ink-faint',
  danger: 'bg-danger-fg text-white hover:bg-red-800 disabled:bg-danger-line',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed',
        size === 'sm' && 'h-8 px-3 text-sm',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-base',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
});

export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  to: string;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        size === 'sm' && 'h-8 px-3 text-sm',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-base',
        variants[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cx('animate-spin', className ?? 'h-5 w-5')}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('rounded-card border border-line bg-surface p-5 shadow-card', className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & FieldProps
>(function Input({ label, error, hint, id, className, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          'block h-10 w-full rounded-lg border bg-white px-3 text-sm text-ink placeholder:text-ink-faint',
          error ? 'border-danger-fg' : 'border-line',
        )}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-danger-fg">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1 text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export function Select({
  label,
  error,
  id,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={className}>
      <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        className="block h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink"
        {...rest}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-sm text-danger-fg">{error}</p>}
    </div>
  );
}

type Tone = 'neutral' | 'brand' | 'success' | 'danger' | 'warn';
const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-success-bg text-success-fg',
  danger: 'bg-danger-bg text-danger-fg',
  warn: 'bg-warn-bg text-warn-fg',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx('animate-pulse rounded-lg bg-slate-200/70', className ?? 'h-5 w-full')}
      aria-hidden="true"
    />
  );
}

/** Loading placeholder for a page section; announced once to screen readers. */
export function LoadingBlock({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={i === 0 ? 'h-24 w-full' : 'h-12 w-full'} />
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface-sunken px-6 py-10 text-center">
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Friendly error with a retry, never raw error text (NFR-2). */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-card border border-danger-line bg-danger-bg px-6 py-6 text-center"
    >
      <p className="font-medium text-danger-fg">We couldn’t load this.</p>
      <p className="mt-1 text-sm text-danger-fg">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Alert({
  tone,
  children,
}: {
  tone: 'success' | 'danger' | 'warn';
  children: ReactNode;
}) {
  const cls = {
    success: 'border-success-line bg-success-bg text-success-fg',
    danger: 'border-danger-line bg-danger-bg text-danger-fg',
    warn: 'border-warn-line bg-warn-bg text-warn-fg',
  }[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx('rounded-lg border px-4 py-3 text-sm', cls)}
    >
      {children}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </Card>
  );
}

/** A progress bar with an accessible value. */
export function Meter({
  value,
  label,
  tone = 'brand',
}: {
  value: number;
  label: string;
  tone?: 'brand' | 'success' | 'warn' | 'danger';
}) {
  const color = {
    brand: 'bg-brand-600',
    success: 'bg-success-fg',
    warn: 'bg-warn-fg',
    danger: 'bg-danger-fg',
  }[tone];
  const pctValue = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pctValue}
      className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
    >
      <div className={cx('h-full rounded-full', color)} style={{ width: `${pctValue}%` }} />
    </div>
  );
}

/** Horizontally scrollable on small screens so the page itself never scrolls sideways (NFR-4). */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[560px] text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cx('border-b border-line py-2 pr-4 font-medium text-ink-muted', className)}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td className={cx('border-b border-line py-3 pr-4 align-top text-ink', className)}>
      {children}
    </td>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex items-center justify-between text-sm text-ink-muted"
    >
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}

export function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-muted hover:bg-slate-100"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export { cx };
