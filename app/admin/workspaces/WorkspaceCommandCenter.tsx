'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, ShieldOff, LogIn, ChevronDown, ChevronUp,
  Settings2, Search, AlertTriangle, CheckCircle2, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface WorkspaceRow {
  id:                     string;
  name:                   string;
  plan:                   string;
  minutes_used:           number;
  minutes_limit:          number;
  is_suspended:           boolean;
  suspended_reason:       string | null;
  suspended_at:           string | null;
  active_calls:           number;
  concurrent_calls_limit: number;
  created_at:             string;
  owner:                  { id: string; name: string; email: string } | null;
  flags:                  { flag: string; enabled: boolean; value: unknown }[];
}

const FLAG_LABELS: Record<string, string> = {
  allow_outbound_calls:    'Outbound Calls',
  allow_sip_trunking:      'SIP Trunking',
  allow_custom_voices:     'Custom Voices',
  allow_api_access:        'API Access',
  allow_campaign_dialer:   'Campaign Dialer',
  max_concurrent_channels: 'Concurrent Channels',
  max_agents:              'Max Agents',
};

interface Props { workspaces: WorkspaceRow[] }

export function WorkspaceCommandCenter({ workspaces: initial }: Props) {
  const [workspaces, setWorkspaces] = useState(initial);
  const [search, setSearch]         = useState('');
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [loading, setLoading]       = useState<Record<string, boolean>>({});
  const router = useRouter();

  const setWsLoading = (id: string, v: boolean) =>
    setLoading((p) => ({ ...p, [id]: v }));

  const filtered = workspaces.filter((w) =>
    !search ||
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.owner?.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSuspend = useCallback(async (ws: WorkspaceRow) => {
    const action = ws.is_suspended ? 'unsuspend' : 'suspend';
    let reason: string | null = null;

    if (action === 'suspend') {
      reason = prompt(`Reason for suspending "${ws.name}":`);
      if (reason === null) return; // user cancelled
    }

    setWsLoading(ws.id, true);
    try {
      const res = await fetch(`/api/admin/workspaces/${ws.id}/suspend?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: reason ? JSON.stringify({ reason }) : '{}',
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      setWorkspaces((prev) => prev.map((w) =>
        w.id === ws.id ? { ...w, is_suspended: !ws.is_suspended, suspended_reason: reason } : w
      ));
      toast.success(action === 'suspend' ? `"${ws.name}" suspended` : `"${ws.name}" reinstated`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setWsLoading(ws.id, false);
    }
  }, []);

  const impersonate = useCallback(async (ws: WorkspaceRow) => {
    setWsLoading(ws.id, true);
    try {
      const res = await fetch(`/api/admin/workspaces/${ws.id}/impersonate`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      const { token } = await res.json() as { token: string };
      // Set impersonation cookie (2h TTL)
      document.cookie = `vos-impersonation=${token}; path=/; max-age=7200; SameSite=Lax`;
      toast.success(`Entering "${ws.name}" workspace…`);
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setWsLoading(ws.id, false);
    }
  }, [router]);

  const toggleFlag = useCallback(async (ws: WorkspaceRow, flag: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/admin/workspaces/${ws.id}/flags`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ flag, enabled }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      setWorkspaces((prev) => prev.map((w) => {
        if (w.id !== ws.id) return w;
        const next = w.flags.map((f) => f.flag === flag ? { ...f, enabled } : f);
        if (!next.some((f) => f.flag === flag)) next.push({ flag, enabled, value: null });
        return { ...w, flags: next };
      }));
      toast.success(`${FLAG_LABELS[flag] ?? flag}: ${enabled ? 'enabled' : 'disabled'}`);
    } catch (e) {
      toast.error(String(e));
    }
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a1a1a]">Workspace Command Center</h1>
          <p className="text-sm text-[#6b6b6b] mt-0.5">
            {workspaces.length} workspaces · suspend, impersonate, and configure feature flags
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2">
          <Search className="h-4 w-4 text-[#a0a0a0]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workspaces or email…"
            className="w-52 text-sm outline-none placeholder:text-[#c0c0c0]"
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total',     value: workspaces.length,                                  icon: Users },
          { label: 'Active',    value: workspaces.filter((w) => !w.is_suspended).length,   icon: CheckCircle2 },
          { label: 'Suspended', value: workspaces.filter((w) => w.is_suspended).length,    icon: AlertTriangle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-[#e5e5e5] bg-white p-4">
            <p className="text-xs text-[#a0a0a0] uppercase tracking-wider">{label}</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-2xl font-bold text-[#1a1a1a]">{value}</span>
              <Icon className="mb-0.5 h-4 w-4 text-[#a0a0a0]" />
            </div>
          </div>
        ))}
      </div>

      {/* Workspace rows */}
      <div className="space-y-2">
        {filtered.map((ws) => (
          <div
            key={ws.id}
            className={`rounded-xl border bg-white transition-shadow ${
              ws.is_suspended ? 'border-red-200 bg-red-50/30' : 'border-[#e5e5e5]'
            }`}
          >
            {/* Main row */}
            <div className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[#1a1a1a] truncate">{ws.name}</span>
                  <Badge variant={ws.plan === 'scale' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                    {ws.plan}
                  </Badge>
                  {ws.is_suspended && (
                    <Badge variant="destructive" className="text-[10px]">Suspended</Badge>
                  )}
                </div>
                <p className="text-xs text-[#a0a0a0] mt-0.5 truncate">
                  {ws.owner?.email ?? 'No owner'} · {ws.active_calls} active calls ·{' '}
                  {Math.round((ws.minutes_used / Math.max(ws.minutes_limit, 1)) * 100)}% minutes used
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {/* Impersonate */}
                <button
                  onClick={() => impersonate(ws)}
                  disabled={loading[ws.id]}
                  className="flex items-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-medium text-[#1a1a1a] hover:bg-[#f5f5f5] transition-colors disabled:opacity-50"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Log in as
                </button>

                {/* Suspend / Unsuspend */}
                <button
                  onClick={() => toggleSuspend(ws)}
                  disabled={loading[ws.id]}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    ws.is_suspended
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {ws.is_suspended
                    ? <><ShieldOff className="h-3.5 w-3.5" />Reinstate</>
                    : <><Shield className="h-3.5 w-3.5" />Suspend</>
                  }
                </button>

                {/* Expand flags */}
                <button
                  onClick={() => setExpanded((p) => p === ws.id ? null : ws.id)}
                  className="flex items-center gap-1 rounded-lg border border-[#e5e5e5] px-2.5 py-1.5 text-xs text-[#606060] hover:bg-[#f5f5f5] transition-colors"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Flags
                  {expanded === ws.id
                    ? <ChevronUp className="h-3 w-3" />
                    : <ChevronDown className="h-3 w-3" />
                  }
                </button>
              </div>
            </div>

            {/* Feature flags panel */}
            {expanded === ws.id && (
              <div className="border-t border-[#f0f0f0] px-4 py-3">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#a0a0a0]">
                  Feature Flags
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {Object.entries(FLAG_LABELS).map(([flag, label]) => {
                    const current = ws.flags.find((f) => f.flag === flag);
                    const enabled = current?.enabled ?? true;
                    return (
                      <label
                        key={flag}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-xs"
                      >
                        <span className="font-medium text-[#1a1a1a]">{label}</span>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => toggleFlag(ws, flag, e.target.checked)}
                          className="ml-2 h-3.5 w-3.5 accent-[#0a0a0a]"
                        />
                      </label>
                    );
                  })}
                </div>
                {ws.is_suspended && ws.suspended_reason && (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    <strong>Suspension reason:</strong> {ws.suspended_reason}
                    {ws.suspended_at && ` · ${format(new Date(ws.suspended_at), 'PPp')}`}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-[#a0a0a0]">No workspaces found.</div>
        )}
      </div>
    </div>
  );
}
