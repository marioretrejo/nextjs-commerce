import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Login' };

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-sm border border-black p-8">
        <h1 className="text-2xl font-bold mb-6">Sign in</h1>
        <p className="text-sm text-neutral-500">Login form — coming in Step 3 (Auth).</p>
      </div>
    </main>
  );
}
