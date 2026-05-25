'use client';

import { cn } from '@/lib/utils';
import { BarChart2, Bot, LayoutDashboard, Megaphone, PhoneCall } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const mobileNavItems = [
  { href: '/dashboard',  label: 'Home',      icon: LayoutDashboard },
  { href: '/agents',     label: 'Agents',    icon: Bot },
  { href: '/campaigns',  label: 'Campaigns', icon: Megaphone },
  { href: '/calls',      label: 'Calls',     icon: PhoneCall },
  { href: '/analytics',  label: 'Analytics', icon: BarChart2 },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-[#e0e0e0] bg-white md:hidden">
      {mobileNavItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors',
              active ? 'text-[#0a0a0a]' : 'text-[#6b6b6b]'
            )}
          >
            <Icon className={cn('h-5 w-5', active ? 'text-[#0a0a0a]' : 'text-[#6b6b6b]')} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
