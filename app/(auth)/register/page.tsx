import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-sm border border-black p-8">
        <h1 className="text-2xl font-bold mb-6">Create account</h1>
        <p className="text-sm text-neutral-500">Register form — coming in Step 3 (Auth).</p>
      </div>
    </main>
  );
}
