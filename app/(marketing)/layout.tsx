import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[#0a0a0a]">
      {/* Nav */}
      <header className="border-b border-[#e0e0e0] sticky top-0 z-50 bg-white/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-[#0a0a0a] flex items-center justify-center">
              <span className="text-white text-xs font-bold">V</span>
            </div>
            <span className="font-semibold text-[#0a0a0a]">VoiceOS</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-[#6b6b6b]">
            <Link href="/#features" className="hover:text-[#0a0a0a] transition-colors">Features</Link>
            <Link href="/#pricing"  className="hover:text-[#0a0a0a] transition-colors">Pricing</Link>
            <Link href="/docs"      className="hover:text-[#0a0a0a] transition-colors">Docs</Link>
            <Link href="/developers" className="hover:text-[#0a0a0a] transition-colors">API</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-[#0a0a0a] text-white hover:bg-[#262626]">Start free</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-[#e0e0e0] mt-24">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm text-[#6b6b6b]">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded bg-[#0a0a0a] flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">V</span>
              </div>
              <span className="font-semibold text-[#0a0a0a]">VoiceOS</span>
            </div>
            <p className="leading-relaxed">AI voice agents for outbound sales and support at scale.</p>
          </div>
          <div>
            <p className="font-medium text-[#0a0a0a] mb-3">Product</p>
            <ul className="space-y-2">
              <li><Link href="/#features" className="hover:text-[#0a0a0a]">Features</Link></li>
              <li><Link href="/#pricing"  className="hover:text-[#0a0a0a]">Pricing</Link></li>
              <li><Link href="/developers" className="hover:text-[#0a0a0a]">API Reference</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-[#0a0a0a] mb-3">Company</p>
            <ul className="space-y-2">
              <li><a href="mailto:hello@voiceos.app" className="hover:text-[#0a0a0a]">Contact</a></li>
              <li><Link href="/privacy" className="hover:text-[#0a0a0a]">Privacy</Link></li>
              <li><Link href="/terms"   className="hover:text-[#0a0a0a]">Terms</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-[#0a0a0a] mb-3">Compliance</p>
            <ul className="space-y-2">
              <li className="text-xs">TCPA compliant</li>
              <li className="text-xs">GDPR ready</li>
              <li className="text-xs">SOC 2 in progress</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[#e0e0e0] py-4 text-center text-xs text-[#6b6b6b]">
          © {new Date().getFullYear()} VoiceOS. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
