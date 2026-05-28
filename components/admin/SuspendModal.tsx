'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield, Loader2 } from 'lucide-react';

interface Props {
  workspace: { id: string; name: string } | null;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

export function SuspendModal({ workspace, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!workspace} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-red-500 shrink-0" />
            Suspend Workspace
          </DialogTitle>
          <DialogDescription className="text-sm text-[#6b6b6b] mt-1">
            Suspending <strong className="text-[#0a0a0a]">{workspace?.name}</strong> will:
            <ul className="mt-2 list-disc pl-5 space-y-0.5 text-xs">
              <li>Block all new calls and token requests immediately.</li>
              <li>Terminate any currently active LiveKit rooms.</li>
              <li>Prevent users from logging in to the workspace.</li>
            </ul>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-xs font-medium text-[#0a0a0a]" htmlFor="suspend-reason">
            Reason for suspension <span className="text-red-500">*</span>
          </label>
          <textarea
            id="suspend-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Payment dispute, ToS violation, abuse report #1234…"
            className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder:text-[#c0c0c0] focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 resize-none"
          />
          <p className="text-[11px] text-[#a0a0a0]">This reason will be stored in audit logs and shown to the workspace owner.</p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!reason.trim() || loading}
            onClick={handleConfirm}
          >
            {loading
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Suspending…</>
              : <><Shield className="h-3.5 w-3.5 mr-1.5" />Suspend Workspace</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
