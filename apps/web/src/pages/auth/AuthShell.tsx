import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/Layout';

/** Ruled exercise-book lines for the sample sheet. */
const ruled = {
  backgroundImage:
    'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, #E3DED2 31px, #E3DED2 32px)',
};

/** A real question rendered the way students see it, instead of a stock illustration. */
function SampleSheet() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md select-none">
      <div className="rounded-md border border-rule bg-paper-raised shadow-pop">
        <div className="flex items-center justify-between border-b border-rule px-6 py-3">
          <span className="eyebrow">Linear equations</span>
          <span className="font-mono text-xs text-ink-3">Q4 / 10</span>
        </div>
        <div className="relative px-6 pb-6 pt-4">
          <span className="absolute inset-y-0 left-12 w-px bg-incorrect/25" />
          <div className="pl-10">
            {/* Text sits on the ruled lines: each line is exactly one 32px row. */}
            <div style={ruled} className="font-serif text-2xl leading-8">
              <p>Solve for x:</p>
              <p>3x + 7 = 22</p>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <span className="flex h-11 w-24 items-center rounded border border-correct bg-paper-raised px-3 font-mono text-lg">
                5
              </span>
              <span className="text-sm font-medium text-correct">Correct</span>
            </div>
            <p className="mt-4 border-l-[3px] border-correct pl-3 text-sm leading-6 text-ink-2">
              Subtract 7 from both sides to get 3x = 15, then divide by 3.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-rule px-6 py-3 text-xs text-ink-3">
          <span className="font-mono">Level 3</span>
          <span className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={`h-1.5 w-5 rounded-full ${n <= 3 ? 'bg-ink' : n === 4 ? 'bg-pencil' : 'bg-paper-sunken'}`}
              />
            ))}
          </span>
          <span>Two in a row moves you up.</span>
        </div>
      </div>
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" aria-label="LearnLoop home" className="self-start">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center">
          <div className="w-full max-w-sm py-12">
            <h1 className="font-serif text-[2rem] font-semibold leading-tight tracking-[-0.01em]">
              {title}
            </h1>
            {subtitle && <p className="mt-2 text-ink-2">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-sm text-ink-2">{footer}</div>}
          </div>
        </div>
        <p className="text-xs text-ink-3">Maths practice for grades 6–8. Demo data is synthetic.</p>
      </main>
      <aside className="hidden items-center border-l border-rule bg-paper-sunken px-12 lg:flex">
        <div className="w-full">
          <SampleSheet />
          <p className="mx-auto mt-8 max-w-md text-sm leading-6 text-ink-2">
            Questions adjust as you go. Get two right and the next one is harder; miss two and it
            eases off. Teachers see which topics the class is stuck on before the test, not after.
          </p>
        </div>
      </aside>
    </div>
  );
}
