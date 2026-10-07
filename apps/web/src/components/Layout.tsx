import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChevronsUpDown,
  ClipboardList,
  House,
  LogOut,
  Menu,
  ScrollText,
  TrendingUp,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@learnloop/shared';
import { useAuth, useUser } from '../lib/auth';
import { Avatar, cx } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV: Record<Role, NavItem[]> = {
  student: [
    { to: '/student', label: 'Home', icon: House, end: true },
    { to: '/student/progress', label: 'Progress', icon: TrendingUp },
  ],
  teacher: [
    { to: '/teacher', label: 'Classes', icon: Users, end: true },
    { to: '/teacher/quizzes', label: 'Quizzes', icon: ClipboardList },
    { to: '/teacher/questions', label: 'Question bank', icon: BookOpen },
  ],
  admin: [
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
  ],
};

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cx('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill={light ? '#FFFFFF' : '#2457E6'} />
        <path
          d="M9.5 21a6.5 6.5 0 1 1 13 0"
          fill="none"
          stroke={light ? '#2457E6' : '#FFFFFF'}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="16" cy="22" r="2.6" fill={light ? '#2457E6' : '#FFFFFF'} />
      </svg>
      <span
        className={cx(
          'text-base font-semibold tracking-tight',
          light ? 'text-white' : 'text-gray-900',
        )}
      >
        LearnLoop
      </span>
    </span>
  );
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              'flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
              isActive
                ? 'bg-brand-50 text-brand-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className={cx('h-[18px] w-[18px]', isActive ? 'text-brand-600' : 'text-gray-400')}
                aria-hidden="true"
              />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/** The signed-in user's menu: profile and log out. Closes on Escape or outside click. */
function UserMenu({ placement }: { placement: 'up' | 'down' }) {
  const user = useUser();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const itemClass =
    'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50';
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-gray-50"
      >
        <Avatar name={user.displayName} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-900">
            {user.displayName}
          </span>
          <span className="block truncate text-xs capitalize text-gray-500">{user.role}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className={cx(
            'absolute z-30 w-full min-w-[200px] rounded-lg border border-gray-200 bg-white p-1 shadow-lg',
            placement === 'up' ? 'bottom-full mb-2' : 'right-0 top-full mt-2 w-56',
          )}
        >
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="truncate text-sm font-medium text-gray-900">{user.displayName}</p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
          <Link role="menuitem" to="/profile" className={itemClass} onClick={() => setOpen(false)}>
            <User className="h-4 w-4 text-gray-400" aria-hidden="true" /> Profile
          </Link>
          <button
            role="menuitem"
            type="button"
            className={itemClass}
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
          >
            <LogOut className="h-4 w-4 text-gray-400" aria-hidden="true" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

/** Persistent app shell: a sidebar on large screens, a top bar and drawer on small ones. */
export function Layout() {
  const user = useUser();
  const items = NAV[user.role];
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setDrawer(false), [pathname]);

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-gray-900 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-gray-200 bg-white lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link to="/" aria-label="LearnLoop home">
            <Logo />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavList items={items} />
        </div>
        <div className="border-t border-gray-200 p-3">
          <UserMenu placement="up" />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
        <Link to="/" aria-label="LearnLoop home">
          <Logo />
        </Link>
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={drawer}
          onClick={() => setDrawer(true)}
          className="-mr-2 rounded-md p-2 text-gray-600 hover:bg-gray-100"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {drawer && (
        <Drawer onClose={() => setDrawer(false)}>
          {<NavList items={items} onNavigate={() => setDrawer(false)} />}
        </Drawer>
      )}

      <main id="main" className="lg:pl-60">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-8 sm:pt-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Drawer({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-gray-900/50" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-lg">
        <div className="flex h-14 items-center justify-between px-5">
          <Logo />
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="-mr-2 rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">{children}</div>
        <div className="border-t border-gray-200 p-3">
          <UserMenu placement="up" />
        </div>
      </div>
    </div>
  );
}
