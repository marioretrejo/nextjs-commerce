'use client';

import { useState } from 'react';
import { AlertTriangle, CreditCard, X } from 'lucide-react';
import { TopUpModal } from './TopUpModal';

interface Props {
  workspaceId: string;
}

export function ActivationBanner({ workspaceId }: Props) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <>
      <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="flex-1 text-sm text-amber-800">
          <span className="font-semibold">Your account is inactive.</span>{' '}
          Add credit to activate your AI agents and start making calls.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 transition-colors shrink-0"
        >
          <CreditCard className="h-3.5 w-3.5" />
          Add Credit
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-500 hover:text-amber-700 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <TopUpModal open={open} onClose={() => setOpen(false)} workspaceId={workspaceId} />
    </>
  );
}
