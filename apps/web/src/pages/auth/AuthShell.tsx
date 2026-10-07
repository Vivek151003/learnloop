import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/Layout';

/** Two columns: the form, and a product panel with a real screenshot of the app. */
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
    <div className="grid grid-cols-1 min-h-screen bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" aria-label="LearnLoop home" className="self-start">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center">
          <div className="w-full max-w-sm py-10">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900">{title}</h1>
            {subtitle && <p className="mt-2 text-gray-500">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-gray-500">{footer}</div>}
          </div>
        </div>
        <p className="text-xs text-gray-500">© 2026 LearnLoop. All demo data is synthetic.</p>
      </main>

      <aside className="relative hidden overflow-hidden bg-brand-600 lg:block" aria-hidden="true">
        <div className="relative z-10 max-w-lg px-12 pt-16">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">
            Know who needs help before the test, not after it.
          </h2>
          <p className="mt-4 text-base text-brand-100">
            Students practise at the right level. Teachers see weak topics and at-risk students for
            the whole class.
          </p>
        </div>
        <img
          src="/preview.jpg"
          alt=""
          width={1400}
          className="absolute left-12 top-60 w-[1100px] max-w-none rounded-xl border border-white/20 shadow-lg"
        />
      </aside>
    </div>
  );
}
