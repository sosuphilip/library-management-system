import { NavLink, Outlet } from 'react-router-dom';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { initial, fullName } from '../lib/format';
import type { Role } from '../lib/types';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles: Role[];
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '🏠', roles: ['ADMIN', 'LIBRARIAN'] },
  { to: '/catalog', label: 'Catalog', icon: '📖', roles: ['ADMIN', 'LIBRARIAN', 'MEMBER'] },
  { to: '/my', label: 'My Account', icon: '👤', roles: ['MEMBER'] },
  { to: '/circulation', label: 'Circulation', icon: '🔁', roles: ['ADMIN', 'LIBRARIAN'] },
  { to: '/members', label: 'Members', icon: '👥', roles: ['ADMIN', 'LIBRARIAN'] },
  { to: '/reports', label: 'Reports', icon: '📊', roles: ['ADMIN', 'LIBRARIAN'] },
  { to: '/admin/audit', label: 'Audit Log', icon: '🧾', roles: ['ADMIN'] },
  { to: '/admin/templates', label: 'Emails', icon: '✉️', roles: ['ADMIN'] }
];

export default function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const visible = NAV.filter((item) => item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="flex">
        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col bg-gradient-to-b from-brand-900 to-brand-950 shadow-xl">
          <div className="flex items-center gap-2 border-b border-brand-800/60 px-5 py-4">
            <span className="text-2xl" aria-hidden>📚</span>
            <div>
              <p className="text-sm font-bold text-white">Library</p>
              <p className="text-xs text-brand-300">Management System</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {visible.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-950/40'
                      : 'text-brand-200 hover:bg-brand-800/70 hover:text-white'
                  )
                }
              >
                <span aria-hidden className="transition-transform duration-150 group-hover:scale-110">
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-brand-800/60 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white shadow-sm ring-2 ring-brand-500/40">
                {initial(fullName(user.firstName, user.lastName))}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {fullName(user.firstName, user.lastName)}
                </p>
                <p className="truncate text-xs text-brand-300">{user.role.toLowerCase()}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <ThemeToggle className="rounded-md p-1.5 text-brand-300 transition-colors hover:bg-brand-800/70 hover:text-white" />
                <button
                  onClick={() => void logout()}
                  className="rounded-md p-1.5 text-brand-300 transition-colors hover:bg-brand-800/70 hover:text-white"
                  title="Sign out"
                >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="ml-60 flex-1 px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
