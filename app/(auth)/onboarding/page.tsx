'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export default function OnboardingPage() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function setup() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/login';
        return;
      }

      const res = await fetch('/api/workspaces', { method: 'POST' });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setErrorMsg(body.error ?? 'Could not set up your workspace. Please try again.');
        setStatus('error');
        return;
      }

      window.location.href = '/dashboard';
    }

    setup();
  }, []);

  if (status === 'error') {
    return (
      <div className="rounded-lg border border-[#e0e0e0] bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">Setup failed</h1>
        <p className="mb-6 text-sm text-[#6b6b6b]">{errorMsg}</p>
        <button
          onClick={() => { setStatus('loading'); setErrorMsg(''); }}
          className="text-sm font-medium text-[#0a0a0a] underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#e0e0e0] bg-white p-8 text-center shadow-sm">
      <div className="mb-4 flex justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0a0a0a] border-t-transparent" />
      </div>
      <h1 className="mb-1 text-xl font-semibold">Setting up your workspace…</h1>
      <p className="text-sm text-[#6b6b6b]">This only takes a second.</p>
    </div>
  );
}
