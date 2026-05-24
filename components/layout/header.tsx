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
import { Progress } from '@/components/ui/progress';
import type { User, Workspace } from '@/lib/supabase/types';
import { Bell, CreditCard, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const planColors: Record<string, string> = {
  free: 'bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]',
  pro: 'bg-[#0a0a0a] text-white border-[#0a0a0a]',
  scale: 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
};

interface HeaderProps {
  user: User;
  workspace: Workspace;
  unreadNotifications?: number;
}

export function Header({ user, workspace, unreadNotifications = 0 }: HeaderProps) {
  const router = useRouter();
  const minutesPct = Math.min((workspace.minutes_used / workspace.minutes_limit) * 100, 100);
  const initials = (user.name ?? user.email)
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  async function signOut() {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="fixed left-56 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-[#e0e0e0] bg-white px-6">
      {/* Minutes used */}
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-3 sm:flex">
          <span className="text-xs text-[#6b6b6b]">
            {workspace.minutes_used.toLocaleString()} / {workspace.minutes_limit.toLocaleString()} min
          </span>
          <div className="w-32">
            <Progress
              value={minutesPct}
              className={minutesPct >= 100 ? '[&>div]:bg-[#0a0a0a]' : minutesPct >= 80 ? '[&>div]:bg-[#6b6b6b]' : ''}
            />
          </div>
          {minutesPct >= 80 && (
            <span className={`text-xs font-medium ${minutesPct >= 100 ? 'text-[#0a0a0a]' : 'text-[#6b6b6b]'}`}>
              {minutesPct >= 100 ? 'Limit reached' : '80% used'}
            </span>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Plan badge */}
        <Badge className={planColors[workspace.plan] ?? planColors['free']}>
          {workspace.plan.charAt(0).toUpperCase() + workspace.plan.slice(1)}
        </Badge>

        {/* Notifications */}
        <Link href="/notifications" className="relative">
          <Button variant="ghost" size="icon">
            <Bell className="h-4 w-4" />
            {unreadNotifications > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0a0a0a] text-[10px] font-bold text-white">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </Button>
        </Link>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[#f5f5f5]">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[120px] truncate text-sm font-medium sm:block">
                {user.name ?? user.email.split('@')[0]}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user.name ?? 'User'}</p>
                <p className="text-xs text-[#6b6b6b] truncate">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/billing" className="flex items-center gap-2 cursor-pointer">
                <CreditCard className="h-4 w-4" /> Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2 text-[#0a0a0a]"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
