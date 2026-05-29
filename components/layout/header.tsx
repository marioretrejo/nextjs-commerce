'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import type { User, Workspace } from '@/lib/supabase/types';
import { Bell, CreditCard, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CommandPaletteTrigger } from '@/components/command-palette';
import { MinutePill } from '@/components/minute-usage/minute-pill';

const planConfig: Record<string, { label: string; className: string }> = {
  free:       { label: 'Free',       className: 'bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]' },
  pro:        { label: 'Pro',        className: 'bg-[#0a0a0a] text-white border-[#0a0a0a]' },
  scale:      { label: 'Scale',      className: 'bg-[#0a0a0a] text-white border-[#0a0a0a]' },
  enterprise: { label: 'Enterprise', className: 'bg-[#0a0a0a] text-white border-[#0a0a0a]' },
};

interface HeaderProps {
  user: User;
  workspace: Workspace;
  unreadNotifications?: number;
}

export function Header({ user, workspace, unreadNotifications = 0 }: HeaderProps) {
  const router = useRouter();
  const initials = (user.name ?? user.email)
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const plan = planConfig[workspace.plan] ?? planConfig['free']!;

  async function signOut() {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="fixed left-56 right-0 top-0 z-30 flex h-14 items-center justify-between glass border-b border-[#e8e8e8]/60 px-6"
      style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}
    >
      {/* Left — minutes pill */}
      <div className="flex items-center gap-3">
        <MinutePill
          workspaceId={workspace.id}
          initialUsed={Number(workspace.minutes_used)}
          limit={Number(workspace.minutes_limit)}
        />
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Plan badge */}
        <Badge className={`${plan.className} text-[10px] px-2 py-0.5 font-semibold tracking-wider`}>
          {plan.label.toUpperCase()}
        </Badge>

        {/* Divider */}
        <span className="h-4 w-px bg-[#e8e8e8]" />

        {/* Command palette */}
        <CommandPaletteTrigger />

        {/* Notifications */}
        <Link href="/notifications" className="relative">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-[#f5f5f5]">
            <Bell className="h-4 w-4 text-[#6b6b6b]" />
            {unreadNotifications > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0a0a0a] text-[9px] font-bold text-white ring-2 ring-white">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </Button>
        </Link>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-[#f5f5f5] transition-colors">
              <Avatar className="h-7 w-7 ring-2 ring-[#e8e8e8]">
                <AvatarImage src={user.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px] font-bold bg-[#0a0a0a] text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[110px] truncate text-[12.5px] font-medium text-[#0a0a0a] sm:block">
                {user.name ?? user.email.split('@')[0]}
              </span>
              <svg className="h-3 w-3 text-[#c0c0c0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl border border-[#e8e8e8] shadow-xl">
            <DropdownMenuLabel className="font-normal px-3 py-2.5">
              <div className="flex flex-col space-y-0.5">
                <p className="text-[12.5px] font-semibold">{user.name ?? 'User'}</p>
                <p className="text-[11px] text-[#9b9b9b] truncate">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#f0f0f0]" />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2 cursor-pointer rounded-lg text-[12.5px]">
                <Settings className="h-3.5 w-3.5 text-[#9b9b9b]" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/billing" className="flex items-center gap-2 cursor-pointer rounded-lg text-[12.5px]">
                <CreditCard className="h-3.5 w-3.5 text-[#9b9b9b]" /> Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#f0f0f0]" />
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2 text-[12.5px] rounded-lg"
              onClick={signOut}
            >
              <LogOut className="h-3.5 w-3.5 text-[#9b9b9b]" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
