export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { User, Workspace, Plan } from '@/lib/supabase/types';
import {
  Users,
  DollarSign,
  Phone,
  Clock,
  BarChart2,
  ChevronRight,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface PlanStats {
  plan: Plan;
  count: number;
  mrr: number;
}

const PLAN_PRICES: Record<Plan, number> = {
  free:  0,
  pro:   79,
  scale: 299,
};

async function broadcastNotification(formData: FormData) {
  'use server';
  const title = formData.get('title') as string;
  const message = formData.get('message') as string;
  if (!title || !message) return;

  await fetch(`${process.env['NEXT_PUBLIC_APP_URL'] ?? ''}/api/admin/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, message }),
  });
}

export default async function AdminPage() {
  const supabase = createAdminClient();

  // Fetch users
  const { data: usersData } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  const recentUsers = (usersData as User[]) ?? [];

  // Plan stats from workspaces
  const { data: workspacesData } = await supabase
    .from('workspaces')
    .select('plan, minutes_used');
  const workspaces = (workspacesData as Pick<Workspace, 'plan' | 'minutes_used'>[]) ?? [];

  const planStats: PlanStats[] = (['free', 'pro', 'scale'] as Plan[]).map((plan) => {
    const ws = workspaces.filter(w => w.plan === plan);
    return {
      plan,
      count: ws.length,
      mrr: ws.length * PLAN_PRICES[plan],
    };
  });
  const totalMRR = planStats.reduce((s, p) => s + p.mrr, 0);

  // Total users count
  const { count: totalUsersCount } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true });

  // Minutes today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayCallsData } = await supabase
    .from('calls')
    .select('duration_seconds')
    .gte('created_at', todayStart.toISOString());
  const todayCalls = (todayCallsData as { duration_seconds: number }[]) ?? [];
  const minutesToday = Math.round(todayCalls.reduce((s, c) => s + c.duration_seconds, 0) / 60);

  // Minutes this month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: monthCallsData } = await supabase
    .from('calls')
    .select('duration_seconds')
    .gte('created_at', monthStart.toISOString());
  const monthCalls = (monthCallsData as { duration_seconds: number }[]) ?? [];
  const minutesMonth = Math.round(monthCalls.reduce((s, c) => s + c.duration_seconds, 0) / 60);

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* Admin header */}
      <header className="bg-[#0a0a0a] text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5" />
            <span className="font-bold text-lg tracking-tight">VoiceOS Admin</span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="opacity-100 font-medium">
              Dashboard
            </Link>
            <Link href="/admin/users" className="opacity-70 hover:opacity-100 transition-opacity">
              Users
            </Link>
            <Link href="/admin/metrics" className="opacity-70 hover:opacity-100 transition-opacity">
              Metrics
            </Link>
            <Separator orientation="vertical" className="h-4 bg-white/20" />
            <Link href="/dashboard" className="opacity-70 hover:opacity-100 transition-opacity text-xs">
              Back to App
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0a0a0a]">Platform Overview</h1>
          <p className="text-sm text-[#6b6b6b] mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')} · Real-time platform metrics
          </p>
        </div>

        {/* Top metric cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Total Users',
              value: (totalUsersCount ?? 0).toLocaleString(),
              icon: <Users className="w-5 h-5 text-[#6b6b6b]" />,
              sub: `${recentUsers.length} new recently`,
            },
            {
              label: 'Monthly MRR',
              value: `$${totalMRR.toLocaleString()}`,
              icon: <DollarSign className="w-5 h-5 text-[#6b6b6b]" />,
              sub: `${workspaces.length} paid workspaces`,
            },
            {
              label: 'Minutes Today',
              value: minutesToday.toLocaleString(),
              icon: <Clock className="w-5 h-5 text-[#6b6b6b]" />,
              sub: `${todayCalls.length} calls`,
            },
            {
              label: 'Minutes This Month',
              value: minutesMonth.toLocaleString(),
              icon: <Phone className="w-5 h-5 text-[#6b6b6b]" />,
              sub: `${monthCalls.length} calls`,
            },
          ].map((m) => (
            <Card key={m.label} className="bg-white">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-sm text-[#6b6b6b]">{m.label}</p>
                  {m.icon}
                </div>
                <p className="text-3xl font-bold text-[#0a0a0a]">{m.value}</p>
                <p className="text-xs text-[#6b6b6b] mt-1">{m.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left column: Plan breakdown + quick links */}
          <div className="col-span-2 space-y-6">
            {/* Plan breakdown */}
            <Card className="bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart2 className="w-4 h-4" />
                    Plan Breakdown
                  </CardTitle>
                  <Link href="/admin/metrics">
                    <Button variant="ghost" size="sm" className="text-xs h-7">
                      View All <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {planStats.map((p) => {
                    const pct = workspaces.length > 0 ? (p.count / workspaces.length) * 100 : 0;
                    return (
                      <div key={p.plan} className="flex items-center gap-4">
                        <Badge
                          className={
                            p.plan === 'scale'
                              ? 'bg-[#0a0a0a] text-white border-transparent w-14 justify-center text-xs'
                              : p.plan === 'pro'
                                ? 'bg-[#f5f5f5] text-[#0a0a0a] border-[#e0e0e0] w-14 justify-center text-xs'
                                : 'border-[#e0e0e0] text-[#6b6b6b] bg-white w-14 justify-center text-xs'
                          }
                        >
                          {p.plan.charAt(0).toUpperCase() + p.plan.slice(1)}
                        </Badge>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs text-[#6b6b6b] mb-1">
                            <span>{p.count} workspaces</span>
                            <span>{pct.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#0a0a0a] rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-[#0a0a0a] w-20 text-right">
                          ${p.mrr.toLocaleString()}/mo
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recent users */}
            <Card className="bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Recent Users
                  </CardTitle>
                  <Link href="/admin/users">
                    <Button variant="ghost" size="sm" className="text-xs h-7">
                      All Users <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-[1fr_1fr_80px_1fr] gap-3 px-5 py-3 border-t border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Plan</span>
                  <span>Joined</span>
                </div>
                <div className="divide-y divide-[#e0e0e0]">
                  {recentUsers.slice(0, 8).map((user) => (
                    <div
                      key={user.id}
                      className="grid grid-cols-[1fr_1fr_80px_1fr] gap-3 px-5 py-3 text-sm items-center hover:bg-[#f5f5f5]"
                    >
                      <span className="font-medium text-[#0a0a0a] truncate">{user.name ?? '—'}</span>
                      <span className="text-[#6b6b6b] truncate text-xs">{user.email}</span>
                      <span>
                        <Badge
                          className={
                            user.plan === 'scale'
                              ? 'bg-[#0a0a0a] text-white border-transparent text-xs'
                              : user.plan === 'pro'
                                ? 'bg-[#f5f5f5] text-[#0a0a0a] border-[#e0e0e0] text-xs'
                                : 'border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs'
                          }
                        >
                          {user.plan}
                        </Badge>
                      </span>
                      <span className="text-[#6b6b6b] text-xs">
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column: Broadcast + quick links */}
          <div className="space-y-6">
            {/* Broadcast form */}
            <Card className="bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Broadcast Notification</CardTitle>
                <CardDescription className="text-xs">
                  Send a notification to all users on the platform.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={broadcastNotification} className="space-y-3">
                  <div className="space-y-1">
                    <label htmlFor="bc-title" className="text-xs font-medium text-[#0a0a0a]">
                      Title
                    </label>
                    <input
                      id="bc-title"
                      name="title"
                      required
                      placeholder="Announcement title"
                      className="w-full h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="bc-msg" className="text-xs font-medium text-[#0a0a0a]">
                      Message
                    </label>
                    <textarea
                      id="bc-msg"
                      name="message"
                      required
                      rows={4}
                      placeholder="Your announcement message…"
                      className="w-full rounded-md border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] resize-none"
                    />
                  </div>
                  <Button type="submit" size="sm" className="w-full text-xs">
                    Send to All Users
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Quick links */}
            <Card className="bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { href: '/admin/users',          label: 'Manage Users',      icon: <Users className="w-4 h-4" /> },
                  { href: '/admin/metrics',        label: 'Platform Metrics',  icon: <BarChart2 className="w-4 h-4" /> },
                  { href: '/admin/infrastructure', label: 'Infrastructure',    icon: <Shield className="w-4 h-4" /> },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between p-3 rounded-lg border border-[#e0e0e0] hover:border-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-[#0a0a0a]">
                      {link.icon}
                      {link.label}
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#6b6b6b]" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
