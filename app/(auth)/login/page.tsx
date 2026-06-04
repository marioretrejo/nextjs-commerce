'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction, type AuthActionState } from '@/app/actions/auth';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';

// Only allow same-origin relative paths to prevent open-redirect attacks and 404s.
function sanitizeRedirect(value: string | null): string {
  if (!value) return '/dashboard';
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes(':')) {
    return value;
  }
  return '/dashboard';
}

const initialState: AuthActionState = { status: 'idle' };

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirect(
    searchParams.get('callbackUrl') ?? searchParams.get('redirect')
  );

  const router = useRouter();
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (state.status === 'error') {
      toast.error(state.error);
    }
    if (state.status === 'success') {
      // router.refresh() flushes the Next.js client cache so the new session
      // cookies written by the Server Action are visible before navigation.
      router.refresh();
      router.push(state.redirectTo);
    }
  }, [state, router]);

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=${redirectTo}`
        }
      });
      if (error || !data?.url) {
        toast.error(error?.message ?? 'Google sign-in is not available. Please use email.');
        setGoogleLoading(false);
      }
      // On success the browser redirects to Google — no further action needed
    } catch {
      toast.error('Something went wrong. Please try again.');
      setGoogleLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#e0e0e0] bg-white p-8 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Welcome back</h1>
      <p className="mb-6 text-sm text-[#6b6b6b]">Sign in to your VoiceOS account</p>

      {/* Google OAuth — temporarily disabled pending SITE_URL configuration */}
      <div className="mb-4 w-full rounded-md border border-[#e0e0e0] bg-[#f5f5f5] px-4 py-3 text-center text-sm text-[#6b6b6b]">
        Google sign-in is temporarily unavailable. Please use email and password below.
      </div>

      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#e0e0e0]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-[#6b6b6b]">or continue with email</span>
        </div>
      </div>

      <form action={formAction} className="space-y-4">
        {/* Passes the sanitized redirectTo to the Server Action */}
        <input type="hidden" name="redirectTo" value={redirectTo} />

        {state.status === 'error' && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-[#6b6b6b] hover:text-[#0a0a0a]">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[#6b6b6b]">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-[#0a0a0a] hover:underline">
          Create account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
