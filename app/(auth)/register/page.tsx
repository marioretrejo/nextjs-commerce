'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', company: '' });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function update(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.name,
            company: form.company
          },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`
        }
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Hard navigation ensures session cookies are sent with the next server request
      window.location.href = '/dashboard';
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`
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
      <h1 className="mb-1 text-xl font-semibold">Create your account</h1>
      <p className="mb-6 text-sm text-[#6b6b6b]">Start for free — no credit card required</p>

      <Button
        type="button"
        variant="secondary"
        className="mb-4 w-full"
        onClick={handleGoogle}
        disabled={googleLoading}
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {googleLoading ? 'Redirecting…' : 'Sign up with Google'}
      </Button>

      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#e0e0e0]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-[#6b6b6b]">or sign up with email</span>
        </div>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" placeholder="Jane Doe" required value={form.name} onChange={update('name')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company">Company</Label>
            <Input id="company" placeholder="Acme Inc." value={form.company} onChange={update('company')} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            required
            value={form.email}
            onChange={update('email')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={update('password')}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Setting up your account…
            </span>
          ) : 'Create account'}
        </Button>
        {loading && (
          <p className="text-center text-xs text-[#6b6b6b]">
            This takes a few seconds — setting up your workspace.
          </p>
        )}
      </form>

      <p className="mt-4 text-center text-xs text-[#6b6b6b]">
        By creating an account you agree to our{' '}
        <Link href="/terms" className="underline hover:text-[#0a0a0a]">Terms</Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline hover:text-[#0a0a0a]">Privacy Policy</Link>.
      </p>

      <p className="mt-4 text-center text-sm text-[#6b6b6b]">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-[#0a0a0a] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
