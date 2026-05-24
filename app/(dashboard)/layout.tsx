import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar — built in Step 5 (Dashboard shell) */}
      <aside className="w-60 border-r border-black flex-shrink-0" />
      <div className="flex-1 flex flex-col">
        {/* Top bar — built in Step 5 */}
        <header className="h-14 border-b border-black" />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
