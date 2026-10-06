import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useUser, useAuth } from '../lib/auth';
import { cx } from './ui';

const NAV = {
  student: [
    { to: '/student', label: 'Home', end: true },
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

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight text-ink">
      <img src="/favicon.svg" alt="" className="h-7 w-7" />
      LearnLoop
    </span>
  );
}

export function Layout() {
  const user = useUser();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const links = NAV[user.role];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      'rounded-lg px-3 py-2 text-sm font-medium',
      isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:bg-slate-100 hover:text-ink',
    );

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/" aria-label="LearnLoop home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="ml-4 hidden gap-1 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={'end' in l} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-3 md:flex">
            <Link to="/profile" className="text-sm text-ink-muted hover:text-ink">
              {user.displayName} <span className="text-ink-faint">· {user.role}</span>
            </Link>
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:bg-slate-100"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              Log out
            </button>
          </div>
          <button
            type="button"
            className="ml-auto rounded-lg p-2 text-ink md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <path
                d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {open && (
          <nav
            id="mobile-nav"
            aria-label="Main"
            className="border-t border-line px-4 py-3 md:hidden"
          >
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={'end' in l}
                  className={linkClass}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </NavLink>
              ))}
              <NavLink to="/profile" className={linkClass} onClick={() => setOpen(false)}>
                Profile
              </NavLink>
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-muted hover:bg-slate-100"
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
              >
                Log out
              </button>
            </div>
          </nav>
        )}
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
