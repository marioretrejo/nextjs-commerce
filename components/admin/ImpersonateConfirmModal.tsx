'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, LogIn, Loader2 } from 'lucide-react';

interface Props {
  workspace: { id: string; name: string; owner?: { email: string } | null } | null;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ImpersonateConfirmModal({ workspace, onConfirm, onClose }: Props) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!checked) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!workspace} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            Enter Client Workspace
          </DialogTitle>
          <DialogDescription className="text-sm text-[#6b6b6b] mt-1">
            You are about to impersonate workspace{' '}
            <strong className="text-[#0a0a0a]">{workspace?.name}</strong>
            {workspace?.owner?.email ? (
              <> owned by <strong className="text-[#0a0a0a]">{workspace.owner.email}</strong></>
            ) : null}
            . You will see and can modify their data as if you were them.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Security notice
          </p>
          <ul className="list-disc pl-5 space-y-0.5 text-xs">
            <li>This session will be recorded in the audit log.</li>
            <li>Any actions you take will be attributed to your admin account.</li>
            <li>The session expires automatically after 2 hours.</li>
            <li>The workspace owner may be notified of this access.</li>
          </ul>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#0a0a0a] shrink-0"
          />
          <span className="text-sm text-[#1a1a1a]">
            I understand this action is logged and attributed to my admin account.
          </span>
        </label>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!checked || loading}
            onClick={handleConfirm}
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            {loading
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Entering…</>
              : <><LogIn className="h-3.5 w-3.5 mr-1.5" />Enter Workspace</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
