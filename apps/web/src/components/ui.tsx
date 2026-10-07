import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  CircleAlert,
  CircleCheck,
  Info,
  Search,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import { errorMessage } from '../lib/api';

// The design system (NFR-1, docs/design.md). Pages build from these pieces, so
// type, spacing, colour and states stay consistent across all three roles.

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ Buttons */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-xs hover:bg-brand-700 disabled:bg-brand-200',
  secondary:
    'border border-gray-300 bg-white text-gray-700 shadow-xs hover:bg-gray-50 disabled:text-gray-400 disabled:hover:bg-white',
  ghost:
    'text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:text-gray-400 disabled:hover:bg-transparent',
  danger: 'bg-danger-600 text-white shadow-xs hover:bg-danger-700 disabled:opacity-50',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-9 gap-2 px-3.5 text-sm',
  lg: 'h-11 gap-2 px-5 text-base',
};
const buttonBase =
  'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, disabled, icon: Icon, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonBase, sizes[size], variants[variant], className)}
      {...rest}
    >
      {loading ? (
        <Spinner className="h-4 w-4" />
      ) : Icon ? (
        <Icon className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
});

export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className,
  children,
}: {
  to: string;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={cx(buttonBase, sizes[size], variants[variant], className)}>
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {children}
    </Link>
  );
}

export function IconButton({
  icon: Icon,
  label,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900',
        className,
      )}
      {...rest}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
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
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------- Layout */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('rounded-lg border border-gray-200 bg-white shadow-xs', className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export interface Crumb {
  label: string;
  to?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
}) {
  return (
    <header className="mb-6">
      {breadcrumbs && (
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex items-center gap-1.5 text-sm text-gray-500"
        >
          {breadcrumbs.map((c, i) => (
            <span key={c.label} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">/</span>}
              {c.to ? (
                <Link to={c.to} className="hover:text-gray-900 hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className="text-gray-700" aria-current="page">
                  {c.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
          {description && <p className="mt-1 text-gray-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------- Forms */

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
}

const fieldClass = (error?: string, width = 'block w-full') =>
  cx(
    width,
    'rounded-md border bg-white px-3 text-sm text-gray-900 shadow-xs placeholder:text-gray-400',
    'focus:outline-none focus:ring-4',
    error
      ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-100'
      : 'border-gray-300 focus:border-brand-600 focus:ring-brand-100',
    'disabled:bg-gray-50 disabled:text-gray-500',
  );

function FieldShell({
  id,
  label,
  error,
  hint,
  className,
  children,
}: FieldProps & { id: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & FieldProps
>(function Input({ label, error, hint, id, className, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell id={inputId} label={label} error={error} hint={hint} className={className}>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cx(fieldClass(error), 'h-10')}
        {...rest}
      />
    </FieldShell>
  );
});

export function TextArea({
  label,
  error,
  hint,
  id,
  className,
  rows = 3,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <FieldShell id={areaId} label={label} error={error} hint={hint} className={className}>
      <textarea
        id={areaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${areaId}-error` : hint ? `${areaId}-hint` : undefined}
        className={cx(fieldClass(error), 'py-2')}
        {...rest}
      />
    </FieldShell>
  );
}

export function Select({
  label,
  error,
  hint,
  id,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <FieldShell id={selectId} label={label} error={error} hint={hint} className={className}>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={cx(fieldClass(error), 'h-10 pr-8')}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

/** A search box with a leading icon, for table toolbars. Labelled for screen readers. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cx('relative', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cx(fieldClass(), 'h-9 pl-9')}
      />
    </div>
  );
}

/** A compact filter dropdown for toolbars (label is visually hidden). */
export function FilterSelect({
  label,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <select
      aria-label={label}
      className={cx(fieldClass(undefined, 'inline-block w-auto'), 'h-9 pr-8', className)}
      {...rest}
    >
      {children}
    </select>
  );
}

/* ------------------------------------------------------------ Status & data */

type Tone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning';
const badgeTones: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-success-50 text-success-700',
  danger: 'bg-danger-50 text-danger-700',
  warning: 'bg-warning-50 text-warning-700',
};

export function Badge({
  tone = 'neutral',
  icon: Icon,
  children,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        badgeTones[tone],
      )}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

const avatarColors = [
  'bg-brand-100 text-brand-700',
  'bg-success-100 text-success-700',
  'bg-warning-100 text-warning-700',
  'bg-danger-100 text-danger-700',
  'bg-gray-200 text-gray-700',
];

/** Initials in a coloured circle; the colour is derived from the name so it stays stable. */
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  const color =
    avatarColors[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % avatarColors.length];
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        size === 'sm' && 'h-7 w-7 text-xs',
        size === 'md' && 'h-8 w-8 text-xs',
        size === 'lg' && 'h-10 w-10 text-sm',
        color,
      )}
    >
      {initials}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'brand',
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: ReactNode;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
}) {
  const chip = {
    brand: 'bg-brand-50 text-brand-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
    danger: 'bg-danger-50 text-danger-600',
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular text-gray-900">{value}</p>
        </div>
        <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', chip)}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>
      {hint && <p className="mt-2 text-xs text-gray-500">{hint}</p>}
    </Card>
  );
}

/** A progress bar with an accessible value. */
export function ProgressBar({
  value,
  label,
  tone = 'brand',
  size = 'md',
  className,
}: {
  value: number;
  label: string;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
}) {
  const color = {
    brand: 'bg-brand-600',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-danger-500',
  }[tone];
  const pctValue = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pctValue}
      className={cx(
        'w-full overflow-hidden rounded-full bg-gray-100',
        size === 'sm' ? 'h-1.5' : 'h-2',
        className,
      )}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-300', color)}
        style={{ width: `${pctValue}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- Tables */

/** Scrolls sideways on small screens so the page itself never does (NFR-4). */
export function TableWrap({
  children,
  minWidth = 640,
}: {
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    // `relative` makes this the containing block for any sr-only (absolutely
    // positioned) text in the table, so it can't widen the page on phones.
    <div className="relative overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cx(
        'border-b border-gray-200 bg-gray-50 px-5 py-2.5 text-xs font-medium text-gray-500',
        className,
      )}
    >
      {children}
    </th>
  );
}

export type SortDir = 'asc' | 'desc';

/** A column header that sorts when clicked. */
export function SortTh({
  children,
  active,
  dir,
  onSort,
  align = 'left',
  className,
}: {
  children: ReactNode;
  active: boolean;
  dir: SortDir;
  onSort: () => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cx(
        'border-b border-gray-200 bg-gray-50 px-5 py-2.5 text-xs font-medium text-gray-500',
        align === 'right' && 'text-right',
        className,
      )}
    >
      <button
        type="button"
        onClick={onSort}
        className={cx(
          'flex items-center gap-1 rounded hover:text-gray-900',
          active && 'text-gray-900',
          align === 'right' && 'ml-auto flex-row-reverse',
        )}
      >
        {children}
        <Icon className={cx('h-3.5 w-3.5', !active && 'text-gray-400')} aria-hidden="true" />
      </button>
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td className={cx('border-b border-gray-100 px-5 py-3 align-middle', className)}>{children}</td>
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
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between border-t border-gray-200 px-5 py-3 text-sm text-gray-500"
    >
      <span className="tabular">
        Showing {from}–{to} of {total}
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

/** Tabs for switching between views of the same page. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const baseId = useId();
  return (
    <div role="tablist" aria-label="Sections" className="mb-6 flex gap-6 border-b border-gray-200">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            id={`${baseId}-${t.id}`}
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cx(
              '-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors',
              active
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cx(
                  'rounded-full px-1.5 py-px text-xs tabular',
                  active ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-600',
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- Feedback */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx('animate-pulse rounded-md bg-gray-100', className ?? 'h-5 w-full')}
      aria-hidden="true"
    />
  );
}

/** Loading placeholder for a page section; announced once to screen readers. */
export function LoadingBlock({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={i === 0 ? 'h-20 w-full' : 'h-12 w-full'} />
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && (
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
      <p className="font-semibold text-gray-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-gray-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A friendly error with a retry, never raw error text (NFR-2). */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-lg border border-danger-100 bg-danger-50 px-6 py-8 text-center"
    >
      <CircleAlert className="mb-2 h-6 w-6 text-danger-600" aria-hidden="true" />
      <p className="font-semibold text-danger-700">This didn’t load</p>
      <p className="mt-0.5 text-danger-700">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

const alertStyles = {
  success: { box: 'border-success-100 bg-success-50 text-success-700', icon: CircleCheck },
  danger: { box: 'border-danger-100 bg-danger-50 text-danger-700', icon: CircleAlert },
  warning: { box: 'border-warning-100 bg-warning-50 text-warning-700', icon: TriangleAlert },
  info: { box: 'border-brand-100 bg-brand-50 text-brand-700', icon: Info },
} as const;

export function Alert({ tone, children }: { tone: keyof typeof alertStyles; children: ReactNode }) {
  const { box, icon: Icon } = alertStyles[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx('flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm', box)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** A dialog that restores focus and closes on Escape or a click outside. */
export function Modal({
  title,
  description,
  open,
  onClose,
  children,
  size = 'md',
}: {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg';
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current
      ?.querySelector<HTMLElement>('input, select, textarea, button:not([aria-label="Close"])')
      ?.focus();
    return () => previous?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/50 p-4 sm:items-center"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white shadow-lg',
          size === 'lg' ? 'max-w-2xl' : 'max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2 -mt-1" />
        </div>
        <div className="px-6 pb-6 pt-4">{children}</div>
      </div>
    </div>
  );
}

/** Join codes and other short codes. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[13px] font-medium tracking-wide text-gray-700">
      {children}
    </span>
  );
}

/** Client-side sorting helper for tables whose rows are all loaded. */
export function sortRows<T>(rows: T[], key: (r: T) => string | number, dir: SortDir): T[] {
  const sorted = [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    return typeof x === 'string' && typeof y === 'string'
      ? x.localeCompare(y)
      : Number(x) - Number(y);
  });
  return dir === 'asc' ? sorted : sorted.reverse();
}
