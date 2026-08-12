import { NavLink, Outlet } from 'react-router-dom';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { Icon, type IconName } from './icons';
import { initial, fullName } from '../lib/format';
import type { Role } from '../lib/types';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  roles: Role[];
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'home', roles: ['ADMIN', 'LIBRARIAN'] },
  { to: '/catalog', label: 'Catalog', icon: 'book', roles: ['ADMIN', 'LIBRARIAN', 'MEMBER'] },
  { to: '/my', label: 'My Account', icon: 'user', roles: ['MEMBER'] },
  { to: '/circulation', label: 'Circulation', icon: 'circulation', roles: ['ADMIN', 'LIBRARIAN'] },
  { to: '/members', label: 'Members', icon: 'members', roles: ['ADMIN', 'LIBRARIAN'] },
  { to: '/reports', label: 'Reports', icon: 'reports', roles: ['ADMIN', 'LIBRARIAN'] },
  { to: '/admin/audit', label: 'Audit Log', icon: 'audit', roles: ['ADMIN'] },
  { to: '/admin/templates', label: 'Emails', icon: 'mail', roles: ['ADMIN'] }
];

export default function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const visible = NAV.filter((item) => item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-paper dark:bg-brand-950">
      <div className="flex">
        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col bg-gradient-to-b from-brand-800 via-brand-900 to-brand-950 shadow-xl">
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brass-300 to-brass-600 text-brand-950 shadow-md">
              <Icon name="library" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold leading-none text-white">Library</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-brass-300">
                Management System
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
            {visible.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-brand-200 hover:bg-white/5 hover:text-white'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute -left-2 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brass-400" />
                    )}
                    <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-white/10 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brass-300 to-brass-600 text-sm font-semibold text-brand-950 shadow-md">
                {initial(fullName(user.firstName, user.lastName))}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {fullName(user.firstName, user.lastName)}
                </p>
                <p className="truncate text-xs text-brand-300">{user.role.toLowerCase()}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <ThemeToggle className="rounded-md p-1.5 text-brand-300 transition-colors hover:bg-white/10 hover:text-white" />
                <button
                  onClick={() => void logout()}
                  className="rounded-md p-1.5 text-brand-300 transition-colors hover:bg-white/10 hover:text-white"
                  title="Sign out"
                >
                  <Icon name="logout" className="h-5 w-5" />
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
