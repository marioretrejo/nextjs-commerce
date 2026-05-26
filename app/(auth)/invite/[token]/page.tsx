'use client';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params['token'] as string;

  const [status, setStatus] = useState<'checking' | 'accepting' | 'done' | 'error'>('checking');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function checkAndAccept() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Not logged in — redirect to register with token in URL
        router.replace(`/register?invite_token=${token}`);
        return;
      }

      // Logged in — accept the invite
      setStatus('accepting');
      const res = await fetch('/api/team/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_token: token })
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setErrorMsg(body.error ?? 'Invalid or expired invite link.');
        setStatus('error');
        return;
      }

      toast.success('You joined the workspace!');
      setStatus('done');
      router.replace('/dashboard');
    }

    checkAndAccept();
  }, [token, router]);

  if (status === 'checking' || status === 'accepting') {
    return (
      <div className="rounded-lg border border-[#e0e0e0] bg-white p-8 shadow-sm text-center">
        <p className="text-[#6b6b6b]">
          {status === 'checking' ? 'Checking invite…' : 'Accepting invite…'}
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-lg border border-[#e0e0e0] bg-white p-8 shadow-sm text-center">
        <h1 className="mb-2 text-lg font-semibold">Invalid invite</h1>
        <p className="mb-6 text-sm text-[#6b6b6b]">{errorMsg}</p>
        <Button asChild variant="secondary">
          <Link href="/login">Go to login</Link>
        </Button>
      </div>
    );
  }

  return null;
}
