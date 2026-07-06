import Link from "next/link";

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-black/10 bg-white/95 px-6 backdrop-blur-sm sm:px-12">
      <span className="text-sm font-semibold tracking-tight">VoiceOS</span>
      <div className="hidden items-center gap-8 text-xs tracking-wide text-[#888] sm:flex uppercase">
        <Link href="#features" className="hover:text-black transition-colors">
          Features
        </Link>
        <Link
          href="#how-it-works"
          className="hover:text-black transition-colors"
        >
          How it works
        </Link>
        <Link href="#pricing" className="hover:text-black transition-colors">
          Pricing
        </Link>
        <Link href="#faq" className="hover:text-black transition-colors">
          FAQ
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="text-xs text-[#888] hover:text-black transition-colors"
        >
          Sign in
        </Link>
        <Link href="/register">
          <button className="rounded-none border border-black bg-black px-4 py-1.5 text-xs font-medium text-white hover:bg-[#222] transition-colors">
            Get started
          </button>
        </Link>
      </div>
    </nav>
  );
}
