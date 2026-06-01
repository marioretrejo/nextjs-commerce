'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Send, CheckCircle2, AlertCircle, Users, ChevronDown, X, Search } from 'lucide-react';

interface PlatformUser {
  id: string;
  name: string | null;
  email: string;
}

export function BroadcastForm() {
  const [title, setTitle]       = useState('');
  const [message, setMessage]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<{ ok: boolean; sent?: number; error?: string } | null>(null);

  // User selector state
  const [users, setUsers]             = useState<PlatformUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set()); // empty = all users
  const [sendToAll, setSendToAll]       = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userSearch, setUserSearch]     = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => r.ok ? r.json() : { users: [] })
      .then((d: { users: PlatformUser[] }) => setUsers(d.users ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggleUser(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setSendToAll(false);
  }

  function selectAll() {
    setSendToAll(true);
    setSelectedIds(new Set());
    setDropdownOpen(false);
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSendToAll(true);
  }

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    return !q || u.email.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q);
  });

  const targetCount = sendToAll ? users.length : selectedIds.size;

  async function send() {
    if (!title.trim() || !message.trim()) return;
    if (!sendToAll && selectedIds.size === 0) return;

    setLoading(true);
    setResult(null);
    try {
      const body: { title: string; message: string; user_ids?: string[] } = {
        title:   title.trim(),
        message: message.trim(),
      };
      if (!sendToAll) body.user_ids = [...selectedIds];

      const res = await fetch('/api/admin/broadcast', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json() as { ok?: boolean; sent?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setResult({ ok: true, sent: data.sent });
      setTitle('');
      setMessage('');
    } catch (e) {
      setResult({ ok: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  const displayLabel = sendToAll
    ? `All Users (${users.length})`
    : selectedIds.size === 0
      ? 'Select recipients…'
      : `${selectedIds.size} user${selectedIds.size !== 1 ? 's' : ''} selected`;

  return (
    <Card className="bg-white border-[#e5e5e5]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Broadcast Notification</CardTitle>
        <p className="text-xs text-[#6b6b6b]">
          Push a message to all users or specific recipients.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* Recipients selector */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[#0a0a0a]">Recipients</label>
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              disabled={loadingUsers}
              className="w-full h-9 flex items-center justify-between rounded-md border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] disabled:opacity-60"
            >
              <span className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-[#9b9b9b] shrink-0" />
                <span className={sendToAll || selectedIds.size > 0 ? 'text-[#0a0a0a]' : 'text-[#9b9b9b]'}>
                  {loadingUsers ? 'Loading users…' : displayLabel}
                </span>
              </span>
              <div className="flex items-center gap-1">
                {!sendToAll && selectedIds.size > 0 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); clearSelection(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); clearSelection(); } }}
                    className="p-0.5 rounded hover:bg-[#f0f0f0]"
                  >
                    <X className="h-3 w-3 text-[#9b9b9b]" />
                  </span>
                )}
                <ChevronDown className={`h-3.5 w-3.5 text-[#9b9b9b] transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {dropdownOpen && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-[#e0e0e0] rounded-xl shadow-lg overflow-hidden">
                {/* Search */}
                <div className="p-2 border-b border-[#f0f0f0]">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#9b9b9b]" />
                    <input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search users…"
                      className="w-full h-7 pl-7 pr-3 text-xs rounded-md border border-[#e0e0e0] bg-[#fafafa] outline-none focus:border-[#0a0a0a]"
                    />
                  </div>
                </div>

                {/* All users option */}
                <div
                  className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-[#f5f5f5] transition-colors border-b border-[#f5f5f5] ${sendToAll ? 'bg-[#f5f5f5]' : ''}`}
                  onClick={selectAll}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${sendToAll ? 'border-[#0a0a0a] bg-[#0a0a0a]' : 'border-[#d0d0d0]'}`}>
                    {sendToAll && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className="text-xs font-semibold text-[#0a0a0a]">All Users</span>
                  <span className="text-[10px] text-[#9b9b9b] ml-auto">{users.length} total</span>
                </div>

                {/* User list */}
                <div className="max-h-48 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-[#9b9b9b] text-center">No users found</p>
                  ) : (
                    filteredUsers.map((u) => {
                      const checked = !sendToAll && selectedIds.has(u.id);
                      return (
                        <div
                          key={u.id}
                          className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[#f5f5f5] transition-colors ${checked ? 'bg-[#f8f8f8]' : ''}`}
                          onClick={() => toggleUser(u.id)}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'border-[#0a0a0a] bg-[#0a0a0a]' : 'border-[#d0d0d0]'}`}>
                            {checked && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            {u.name && <p className="text-xs font-medium text-[#0a0a0a] truncate leading-tight">{u.name}</p>}
                            <p className={`text-xs truncate ${u.name ? 'text-[#9b9b9b]' : 'text-[#0a0a0a] font-medium'}`}>{u.email}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Done */}
                {!sendToAll && selectedIds.size > 0 && (
                  <div className="p-2 border-t border-[#f0f0f0]">
                    <button
                      onClick={() => setDropdownOpen(false)}
                      className="w-full h-7 text-xs font-medium bg-[#0a0a0a] text-white rounded-md hover:bg-[#1a1a1a] transition-colors"
                    >
                      Confirm {selectedIds.size} recipient{selectedIds.size !== 1 ? 's' : ''}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[#0a0a0a]">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title"
            className="w-full h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
          />
        </div>

        {/* Message */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-[#0a0a0a]">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Your announcement…"
            className="w-full rounded-md border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] resize-none"
          />
        </div>

        {/* Result feedback */}
        {result && (
          <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium ${
            result.ok
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {result.ok
              ? <><CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Sent to {result.sent} user{result.sent !== 1 ? 's' : ''} successfully</>
              : <><AlertCircle className="h-3.5 w-3.5 shrink-0" /> {result.error}</>
            }
          </div>
        )}

        {/* Send button */}
        <Button
          onClick={send}
          disabled={loading || !title.trim() || !message.trim() || (!sendToAll && selectedIds.size === 0)}
          size="sm"
          className="w-full text-xs"
        >
          {loading
            ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Sending…</>
            : <><Send className="h-3.5 w-3.5 mr-1.5" />
                Send to {sendToAll ? `All ${users.length} Users` : `${targetCount} User${targetCount !== 1 ? 's' : ''}`}
              </>
          }
        </Button>
      </CardContent>
    </Card>
  );
}
