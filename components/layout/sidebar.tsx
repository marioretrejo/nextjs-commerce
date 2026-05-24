'use client';

import { cn } from '@/lib/utils';
import {
  BarChart2,
  Bell,
  Bot,
  CreditCard,
  Globe,
  LayoutDashboard,
  Megaphone,
  Phone,
  PhoneCall,
  Settings,
  Shield,
  Star,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/agents',       label: 'Agents',       icon: Bot },
  { href: '/campaigns',    label: 'Campaigns',    icon: Megaphone },
  { href: '/calls',        label: 'Calls',        icon: PhoneCall },
  { href: '/analytics',   label: 'Analytics',    icon: BarChart2 },
  { href: '/quality',     label: 'Quality',      icon: Star },
  { href: '/numbers',     label: 'Numbers',      icon: Phone },
  { href: '/integrations',label: 'Integrations', icon: Globe },
  { href: '/team',        label: 'Team',         icon: Users },
  { href: '/billing',     label: 'Billing',      icon: CreditCard },
  { href: '/settings',    label: 'Settings',     icon: Settings },
];

const adminItems = [
  { href: '/admin', label: 'Superadmin', icon: Shield },
];

interface SidebarProps {
  isSuperadmin?: boolean;
}

export function Sidebar({ isSuperadmin = false }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-[#e0e0e0] bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-[#e0e0e0] px-5">
        <span className="text-base font-bold tracking-tight">VoiceOS</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
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
