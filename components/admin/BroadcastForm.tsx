'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Send, CheckCircle2, AlertCircle } from 'lucide-react';

export function BroadcastForm() {
  const [title, setTitle]     = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{ ok: boolean; sent?: number; error?: string } | null>(null);

  async function send() {
    if (!title.trim() || !message.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), message: message.trim() }),
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

  return (
    <Card className="bg-white border-[#e5e5e5]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Broadcast Notification</CardTitle>
        <p className="text-xs text-[#6b6b6b]">Push a platform-wide announcement to all users.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-[#0a0a0a]">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title"
            className="w-full h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
          />
        </div>
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

        {result && (
          <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium ${
            result.ok
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {result.ok
              ? <><CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Sent to {result.sent} user{result.sent !== 1 ? 's' : ''}</>
              : <><AlertCircle className="h-3.5 w-3.5 shrink-0" /> {result.error}</>
            }
          </div>
        )}

        <Button
          onClick={send}
          disabled={loading || !title.trim() || !message.trim()}
          size="sm"
          className="w-full text-xs"
        >
          {loading
            ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Sending…</>
            : <><Send className="h-3.5 w-3.5 mr-1.5" /> Send to All Users</>
          }
        </Button>
      </CardContent>
    </Card>
  );
}
