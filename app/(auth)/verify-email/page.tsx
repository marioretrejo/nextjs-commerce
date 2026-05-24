'use client';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const [resending, setResending] = useState(false);

  async function resend() {
    if (!email) return;
    setResending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` }
    });
    if (error) toast.error(error.message);
    else toast.success('Verification email resent');
    setResending(false);
  }

  return (
    <div className="rounded-lg border border-[#e0e0e0] bg-white p-8 text-center shadow-sm">
      <div className="mb-4 flex justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f5f5]">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
      <h1 className="mb-2 text-xl font-semibold">Verify your email</h1>
      <p className="mb-6 text-sm text-[#6b6b6b]">
        We sent a confirmation link to{' '}
        {email ? <strong>{email}</strong> : 'your email address'}. Click the link to activate your account.
      </p>

      <div className="space-y-3">
        {email && (
          <Button variant="secondary" className="w-full" onClick={resend} disabled={resending}>
            {resending ? 'Sending…' : 'Resend verification email'}
          </Button>
        )}
        <Link href="/login">
          <Button variant="ghost" className="w-full text-[#6b6b6b]">
            Back to sign in
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
