'use client';

import { useState } from 'react';
import { ShieldAlert, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  workspaceId:   string;
  workspaceName: string;
}

export function ImpersonationBanner({ workspaceId, workspaceName }: Props) {
  const [exiting, setExiting] = useState(false);
  const router = useRouter();

  const exit = async () => {
    setExiting(true);
    try {
      await fetch(`/api/admin/workspaces/${workspaceId}/impersonate`, { method: 'DELETE' });
      // Clear the impersonation cookie
      document.cookie = 'vos-impersonation=; Max-Age=0; path=/';
      router.push('/admin/workspaces');
      router.refresh();
    } catch {
      setExiting(false);
    }
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex h-10 items-center justify-between bg-amber-500 px-4 text-sm font-medium text-amber-950">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>
          You are impersonating workspace: <strong>{workspaceName}</strong>
          {' '}— changes you make are real.
        </span>
      </div>
      <button
        onClick={exit}
        disabled={exiting}
        className="flex items-center gap-1.5 rounded-md bg-amber-800/20 px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-800/30 transition-colors disabled:opacity-60"
      >
        {exiting ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
        Exit Impersonation
      </button>
    </div>
  );
}
