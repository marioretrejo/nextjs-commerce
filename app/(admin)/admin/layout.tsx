import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/20 px-6 py-4">
        <span className="font-bold tracking-widest text-xs uppercase">VoiceOS · Superadmin</span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
