'use client';

// Isolated admin layout — no shared app header/nav/copilot widgets
import { cn } from '@/lib/utils';
import {
  Activity,
  BarChart2,
  Building2,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin',             label: 'Overview',      icon: LayoutDashboard, exact: true },
  { href: '/admin/workspaces',  label: 'Workspaces',    icon: Building2 },
  { href: '/admin/billing',     label: 'Billing Audits',icon: CreditCard },
  { href: '/admin/metrics',     label: 'Metrics',       icon: BarChart2 },
  { href: '/admin/infrastructure', label: 'Infrastructure', icon: Activity },
  { href: '/admin/settings',    label: 'Global Settings', icon: Settings },
];

function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-56 flex-col bg-[#0a0a0a] text-white">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-5">
        <Shield className="h-4 w-4 text-white/70 shrink-0" />
        <span className="text-sm font-bold tracking-tight">VoiceOS Admin</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-white/15 text-white'
                  : 'text-white/50 hover:bg-white/8 hover:text-white/90'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3 space-y-0.5">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/50 hover:bg-white/8 hover:text-white/90 transition-colors"
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          Back to App
        </Link>
        <Link
          href="/login"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/50 hover:bg-white/8 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </Link>
      </div>
    </aside>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f4f5]">
      <AdminSidebar />
      <div className="ml-56">
        {children}
      </div>
    </div>
  );
}
