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
import { errorMessage } from '../lib/api';

// The design system (NFR-1, docs/design.md). Every page builds from these pieces,
// so type, spacing, colour and states stay consistent across all three roles.

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';
type Size = 'sm' | 'md' | 'lg';

// Tactile "key" buttons: a solid ledge that presses down, instead of a blurred shadow.
const variants: Record<Variant, string> = {
  primary:
    'bg-ink text-white shadow-key hover:bg-black active:translate-y-[2px] active:shadow-none disabled:bg-ink-4 disabled:shadow-none',
  secondary:
    'border border-rule-strong bg-paper-raised text-ink shadow-key-light hover:border-ink-3 active:translate-y-[2px] active:shadow-none disabled:text-ink-3',
  quiet: 'text-ink-2 hover:bg-paper-sunken hover:text-ink disabled:text-ink-4',
  danger:
    'bg-incorrect text-white shadow-[0_2px_0_0_#7A2416] hover:brightness-95 active:translate-y-[2px] active:shadow-none disabled:opacity-50',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};
const buttonBase =
  'inline-flex select-none items-center justify-center gap-2 rounded font-medium transition-[transform,box-shadow,background-color] duration-75 disabled:cursor-not-allowed';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
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
      className={cx(buttonBase, sizes[size], variants[variant], className)}
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
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={cx(buttonBase, sizes[size], variants[variant], className)}>
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
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        opacity="0.25"
      />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" fill="none" />
    </svg>
  );
}

/** A bordered sheet. No shadow: separation comes from the rule and the paper tone. */
export function Panel({
  className,
  children,
  as: Tag = 'div',
}: {
  className?: string;
  children: ReactNode;
  as?: 'div' | 'section';
}) {
  return (
    <Tag className={cx('rounded border border-rule bg-paper-raised', className)}>{children}</Tag>
  );
}

/** Panel with standard padding. Kept for pages that want a simple padded block. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <Panel className={cx('p-5', className)}>{children}</Panel>;
}

/** A panel header row: small title on the left, optional actions on the right. */
export function PanelHeader({
  title,
  meta,
  actions,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-5 py-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {meta && <span className="text-sm text-ink-3">{meta}</span>}
      {actions}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-rule pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-serif text-[2rem] font-semibold leading-tight tracking-[-0.01em]">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** A section heading inside a page. */
export function SectionTitle({
  children,
  aside,
  id,
}: {
  children: ReactNode;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 id={id} className="font-serif text-xl font-semibold">
        {children}
      </h2>
      {aside && <div className="text-sm text-ink-3">{aside}</div>}
    </div>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
}

const fieldClass = (error?: string) =>
  cx(
    'block w-full rounded border bg-paper-raised px-3 text-[15px] text-ink placeholder:text-ink-3',
    'focus:border-ink focus:outline-none focus-visible:outline-none',
    error ? 'border-incorrect' : 'border-rule-strong',
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
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-incorrect">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-3">
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

type Tone = 'neutral' | 'pencil' | 'right' | 'wrong';
const tagTones: Record<Tone, string> = {
  neutral: 'border-rule-strong text-ink-2',
  pencil: 'border-pencil bg-pencil-soft text-pencil-deep',
  right: 'border-correct/30 bg-correct-soft text-correct',
  wrong: 'border-incorrect/30 bg-incorrect-soft text-incorrect',
};

/** A small square-cornered label, like a stamp in a margin. Use sparingly. */
export function Tag({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center whitespace-nowrap rounded-sm border px-1.5 py-px text-xs font-medium',
        tagTones[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Inline status text with a coloured dot. Lighter than a Tag for table cells. */
export function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  const dot = {
    neutral: 'bg-ink-4',
    pencil: 'bg-pencil',
    right: 'bg-correct',
    wrong: 'bg-incorrect',
  }[tone];
  const text = {
    neutral: 'text-ink-2',
    pencil: 'text-pencil-deep',
    right: 'text-correct',
    wrong: 'text-incorrect',
  }[tone];
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap text-sm', text)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', dot)} aria-hidden="true" />
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx('animate-pulse rounded bg-paper-sunken', className ?? 'h-5 w-full')}
      aria-hidden="true"
    />
  );
}

/** Loading placeholder for a page section; announced once to screen readers. */
export function LoadingBlock({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={i === 0 ? 'h-16 w-full' : 'h-10 w-full'} />
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
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded border border-dashed border-rule-strong px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** A friendly error with a retry, never raw error text (NFR-2). */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded border border-incorrect/30 bg-incorrect-soft px-5 py-4">
      <p className="font-medium text-incorrect">This didn’t load.</p>
      <p className="mt-0.5 text-sm text-incorrect">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** A notice bar with a coloured left rule, like a margin note. */
export function Alert({
  tone,
  children,
}: {
  tone: 'right' | 'wrong' | 'pencil';
  children: ReactNode;
}) {
  const cls = {
    right: 'border-correct bg-correct-soft text-correct',
    wrong: 'border-incorrect bg-incorrect-soft text-incorrect',
    pencil: 'border-pencil bg-pencil-soft text-pencil-deep',
  }[tone];
  return (
    <div
      role={tone === 'wrong' ? 'alert' : 'status'}
      className={cx('rounded-sm border-l-[3px] px-3 py-2 text-sm', cls)}
    >
      {children}
    </div>
  );
}

/** One row of figures divided by rules, instead of a grid of identical stat boxes. */
export function StatStrip({
  items,
}: {
  items: { label: string; value: ReactNode; note?: ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-2 border-y border-rule sm:flex sm:divide-x sm:divide-rule">
      {items.map((s, i) => (
        <div
          key={s.label}
          className={cx(
            'px-0 py-4 sm:flex-1 sm:px-6 sm:first:pl-0',
            i % 2 === 1 && 'pl-4 max-sm:border-l max-sm:border-rule',
            i >= 2 && 'max-sm:border-t max-sm:border-rule',
          )}
        >
          <dt className="eyebrow">{s.label}</dt>
          <dd className="mt-1 font-mono text-2xl font-medium tabular-nums tracking-tight">
            {s.value}
          </dd>
          {s.note && <dd className="mt-0.5 text-xs text-ink-3">{s.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** A thin progress bar with an accessible value. */
export function Meter({
  value,
  label,
  tone = 'ink',
  className,
}: {
  value: number;
  label: string;
  tone?: 'ink' | 'pencil' | 'right' | 'wrong';
  className?: string;
}) {
  const color = { ink: 'bg-ink', pencil: 'bg-pencil', right: 'bg-correct', wrong: 'bg-incorrect' }[
    tone
  ];
  const pctValue = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pctValue}
      className={cx('h-1.5 w-full overflow-hidden rounded-full bg-paper-sunken', className)}
    >
      <div className={cx('h-full rounded-full', color)} style={{ width: `${pctValue}%` }} />
    </div>
  );
}

/** Scrolls sideways on small screens so the page itself never does (NFR-4). */
export function TableWrap({
  children,
  minWidth = 560,
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
      className={cx('eyebrow border-b border-rule px-5 py-2.5 font-normal first:pl-5', className)}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx('border-b border-rule px-5 py-3 align-top', className)}>{children}</td>;
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
      className="flex items-center justify-between px-5 py-3 text-sm text-ink-3"
    >
      <span className="font-mono text-xs">
        {from}–{to} of {total}
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

/** A dialog that traps nothing fancy but restores focus and closes on Escape. */
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
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    return () => previous?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-4 sm:items-center"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-md border border-rule bg-paper-raised shadow-pop"
      >
        <div className="flex items-center justify-between gap-4 border-b border-rule px-6 py-4">
          <h2 id={titleId} className="font-serif text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded p-1.5 text-ink-3 hover:bg-paper-sunken hover:text-ink"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/** Join codes and other short codes, set in mono with a dotted rule. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-sm border border-dashed border-rule-strong bg-paper px-1.5 py-0.5 font-mono text-sm font-medium tracking-wider">
      {children}
    </span>
  );
}
