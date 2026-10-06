import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '../lib/auth';
import { cx } from './ui';

const NAV = {
  student: [
    { to: '/student', label: 'Practice', end: true },
    { to: '/student/progress', label: 'Progress' },
  ],
  teacher: [
    { to: '/teacher', label: 'Classes', end: true },
    { to: '/teacher/quizzes', label: 'Quizzes' },
    { to: '/teacher/questions', label: 'Question bank' },
  ],
  admin: [
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/audit', label: 'Audit log' },
  ],
} as const;

/** The wordmark: an arc landing on a dot, a loop closing on the next question. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('flex items-center gap-2', className)}>
      <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="#1C1B17" />
        <path
          d="M9 20.5c0-4.7 3.1-8.5 7-8.5s7 3.8 7 8.5"
          fill="none"
          stroke="#F6F4EE"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle cx="16" cy="21" r="3" fill="#F2C230" />
      </svg>
      <span className="font-serif text-lg font-semibold tracking-tight">LearnLoop</span>
    </span>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

export function Layout() {
  const user = useUser();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const links = NAV[user.role];

  const signOut = async () => {
    await logout();
    navigate('/login');
  };

  // Active tab: ink text with a pencil underline, like a highlighted heading.
  const desktopLink = ({ isActive }: { isActive: boolean }) =>
    cx(
      'relative flex h-14 items-center px-1 text-sm transition-colors',
      isActive
        ? 'font-medium text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-pencil'
        : 'text-ink-2 hover:text-ink',
    );
  const mobileLink = ({ isActive }: { isActive: boolean }) =>
    cx(
      'block rounded px-3 py-2.5',
      isActive ? 'bg-pencil-soft font-medium' : 'text-ink-2 hover:bg-paper-sunken',
    );

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <header className="border-b border-rule bg-paper">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6">
          <Link to="/" aria-label="LearnLoop home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden gap-6 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={'end' in l} className={desktopLink}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-4 md:flex">
            <Link
              to="/profile"
              className="flex items-center gap-2 text-sm text-ink-2 hover:text-ink"
            >
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-rule-strong bg-paper-raised font-mono text-2xs font-medium text-ink"
              >
                {initials(user.displayName)}
              </span>
              <span>
                {user.displayName}
                <span className="sr-only">, {user.role}. Profile</span>
              </span>
            </Link>
            <span className="h-4 w-px bg-rule-strong" aria-hidden="true" />
            <button type="button" className="text-sm text-ink-2 hover:text-ink" onClick={signOut}>
              Log out
            </button>
          </div>
          <button
            type="button"
            className="-mr-2 ml-auto rounded p-2 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 8h16M4 16h16'}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {open && (
          <nav
            id="mobile-nav"
            aria-label="Main"
            className="border-t border-rule px-4 py-3 md:hidden"
          >
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={'end' in l}
                className={mobileLink}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </NavLink>
            ))}
            <div className="mt-2 border-t border-rule pt-2">
              <NavLink to="/profile" className={mobileLink} onClick={() => setOpen(false)}>
                {user.displayName} · profile
              </NavLink>
              <button
                type="button"
                className="block w-full rounded px-3 py-2.5 text-left text-ink-2 hover:bg-paper-sunken"
                onClick={signOut}
              >
                Log out
              </button>
            </div>
          </nav>
        )}
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
