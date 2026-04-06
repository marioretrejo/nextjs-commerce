'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  HomeIcon,
  BanknotesIcon,
  UsersIcon,
  BellIcon,
  BoltIcon,
  TrophyIcon,
  ClockIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/ftds', label: 'FTDs', icon: BanknotesIcon },
  { href: '/leads', label: 'Leads', icon: UsersIcon },
  { href: '/alerts', label: 'Alertas', icon: BellIcon },
  { href: '/trigger', label: '¿Cuándo Disparar?', icon: BoltIcon },
  { href: '/top', label: 'Top Campaña / País', icon: TrophyIcon },
  { href: '/campaigns', label: 'Campañas', icon: ChartBarIcon },
  { href: '/history', label: 'Historial', icon: ClockIcon },
  { href: '/settings', label: 'Configuración', icon: Cog6ToothIcon }
];

function AlertBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchAlerts = () =>
      fetch('/api/alerts?status=active&limit=1')
        .then((r) => r.json())
        .then((d) => setCount(d.total ?? 0))
        .catch(() => {});
    fetchAlerts();
    const id = setInterval(fetchAlerts, 30000);
    return () => clearInterval(id);
  }, []);

  if (count === 0) return null;
  return (
    <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
      {count > 9 ? '9+' : count}
    </span>
  );
}

export default function TrackerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => {
        if (!r.ok) router.push('/login');
        return r.json();
      })
      .then((d) => {
        if (d.username) setUsername(d.username);
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const isLoginPage = pathname === '/login';
  if (isLoginPage) return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-white">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:relative lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
            <BoltIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Campaign Tracker</p>
            <p className="text-xs text-slate-400">Conversión & Afiliados</p>
          </div>
          <button
            className="ml-auto lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <XMarkIcon className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-indigo-600/20 text-indigo-400 border-r-2 border-indigo-500'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
                {href === '/alerts' && <AlertBadge />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600/20 text-sm font-bold text-indigo-400">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{username}</p>
              <p className="text-xs text-slate-500">Operador</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400"
              title="Cerrar sesión"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="flex h-16 items-center gap-4 border-b border-slate-800 bg-slate-900 px-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Bars3Icon className="h-5 w-5 text-slate-400" />
          </button>
          <span className="font-semibold text-white">Campaign Tracker</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
