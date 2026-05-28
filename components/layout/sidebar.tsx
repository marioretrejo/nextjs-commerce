'use client';

import { cn } from '@/lib/utils';
import {
  BarChart2,
  Bell,
  Bot,
  Code2,
  Cpu,
  CreditCard,
  DollarSign,
  Globe,
  Key,
  LayoutDashboard,
  Megaphone,
  Phone,
  PhoneCall,
  Radio,
  Settings,
  Shield,
  ShieldCheck,
  Star,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard',       label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/agents',          label: 'Agents',        icon: Bot },
  { href: '/campaigns',       label: 'Campaigns',     icon: Megaphone },
  { href: '/calls',           label: 'Calls',         icon: PhoneCall },
  { href: '/calls/live',      label: 'Live Monitor',  icon: Radio, pulse: true },
  { href: '/analytics',       label: 'Analytics',     icon: BarChart2 },
  { href: '/analytics/costs', label: 'Usage',         icon: DollarSign },
  { href: '/quality',         label: 'Quality',       icon: Star },
  { href: '/numbers',         label: 'Numbers',       icon: Phone },
  { href: '/compliance',      label: 'Compliance',    icon: ShieldCheck },
  { href: '/integrations',    label: 'Integrations',  icon: Globe },
  { href: '/integrations/webhooks', label: 'Webhooks', icon: Bell },
  { href: '/team',            label: 'Team',          icon: Users },
  { href: '/billing',         label: 'Billing',       icon: CreditCard },
  { href: '/settings',        label: 'Settings',      icon: Settings },
  { href: '/developers',      label: 'Developers',    icon: Code2 },
];

const adminItems = [
  { href: '/admin',                label: 'Superadmin',    icon: Shield },
  { href: '/admin/workspaces',     label: 'Workspaces',    icon: Cpu },
  { href: '/admin/infrastructure', label: 'Infrastructure', icon: Cpu },
];

interface SidebarProps {
  isSuperadmin?: boolean;
  appName?: string;
}

export function Sidebar({ isSuperadmin = false, appName = 'VoiceOS' }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-[#e0e0e0] bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-[#e0e0e0] px-5">
        <span className="text-base font-bold tracking-tight truncate">{appName}</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {navItems.map(({ href, label, icon: Icon, pulse }) => {
          const active = pathname === href || (href !== '/calls' && href !== '/analytics' && pathname.startsWith(href + '/'));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-[#0a0a0a] text-white'
                  : 'text-[#6b6b6b] hover:bg-[#f5f5f5] hover:text-[#0a0a0a]'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {pulse && (
                <span className="ml-auto flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
              )}
            </Link>
          );
        })}

        {isSuperadmin && (
          <>
            <div className="my-2 border-t border-[#e0e0e0]" />
            {adminItems.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[#0a0a0a] text-white'
                      : 'text-[#6b6b6b] hover:bg-[#f5f5f5] hover:text-[#0a0a0a]'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </aside>
  );
}
