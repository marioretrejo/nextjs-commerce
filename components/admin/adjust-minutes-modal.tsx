'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Props {
  workspaceId: string;
  currentUsed: number;
  currentLimit: number;
  userName: string;
}

export function AdjustMinutesModal({ workspaceId, currentUsed, currentLimit, userName }: Props) {
  const [open, setOpen] = useState(false);
  const [minutesUsed, setMinutesUsed] = useState(String(currentUsed));
  const [minutesLimit, setMinutesLimit] = useState(String(currentLimit));
  const [bonusMinutes, setBonusMinutes] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!reason.trim()) { toast.error('Reason is required'); return; }
    setSaving(true);
    const res = await fetch('/api/admin/adjust-minutes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: workspaceId,
        minutes_used:  minutesUsed  !== String(currentUsed)  ? Number(minutesUsed)  : undefined,
        minutes_limit: minutesLimit !== String(currentLimit) ? Number(minutesLimit) : undefined,
        bonus_minutes: bonusMinutes ? Number(bonusMinutes) : undefined,
        reason,
      }),
    });
    if (res.ok) {
      toast.success('Minutes adjusted');
      setOpen(false);
    } else {
      const d = await res.json() as { error?: string };
      toast.error(d.error ?? 'Failed to adjust minutes');
    }
    setSaving(false);
  }

  return (
    <>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(true)}>
        Adjust Minutes
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Minutes — {userName}</DialogTitle>
            <DialogDescription>Override usage or limit. All changes are logged in workspace_events.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Override minutes_used</Label>
              <Input type="number" min="0" value={minutesUsed} onChange={e => setMinutesUsed(e.target.value)} />
              <p className="text-xs text-[#6b6b6b]">Current: {currentUsed}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Override minutes_limit</Label>
              <Input type="number" min="0" value={minutesLimit} onChange={e => setMinutesLimit(e.target.value)} />
              <p className="text-xs text-[#6b6b6b]">Current: {currentLimit}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Add bonus minutes (reduces minutes_used by this amount)</Label>
              <Input type="number" min="0" value={bonusMinutes} onChange={e => setBonusMinutes(e.target.value)} placeholder="e.g. 100" />
            </div>
            <div className="space-y-1.5">
              <Label>Reason (required)</Label>
              <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Customer complaint, compensation" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !reason.trim()}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
