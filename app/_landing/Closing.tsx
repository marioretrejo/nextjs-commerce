import Link from "next/link";
import { FAQ, SERIF } from "./data";

export function Faq() {
  return (
    <section
      className="border-t border-black/8 bg-[#f2f2f2] px-6 py-28 sm:px-12"
      id="faq"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-16 flex items-end justify-between border-b border-black/10 pb-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
            FAQ
          </p>
          <h2
            className="text-2xl font-light tracking-tight sm:text-3xl text-black"
            style={SERIF}
          >
            Frequently asked questions
          </h2>
        </div>
        <div className="divide-y divide-black/8">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-6">
              <summary className="flex cursor-pointer items-start justify-between gap-6 text-sm font-medium text-black list-none">
                {item.q}
                <span className="mt-0.5 shrink-0 text-[#888] group-open:rotate-45 transition-transform duration-200 inline-block">
                  +
                </span>
              </summary>
              <p className="mt-4 text-sm leading-relaxed text-[#555] pr-8">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="border-t border-black/8 bg-white px-6 py-32 sm:px-12">
      <div className="mx-auto max-w-5xl">
        <p className="mb-6 text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
          Get started
        </p>
        <h2
          className="mb-10 max-w-2xl text-4xl font-light leading-tight tracking-tight text-black sm:text-5xl"
          style={SERIF}
        >
          Ready to 10x your outreach?
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/register">
            <button className="border border-black bg-black px-8 py-3 text-sm font-medium text-white hover:bg-[#222] transition-colors">
              Start for free
            </button>
          </Link>
          <Link href="/login">
            <button className="border border-black/20 px-8 py-3 text-sm font-medium text-black hover:border-black transition-colors">
              Sign in
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-black/8 bg-white px-6 py-10 sm:px-12">
      <div className="mx-auto max-w-5xl flex flex-col items-start justify-between gap-8 sm:flex-row">
        <div>
          <span className="text-sm font-semibold text-black">VoiceOS</span>
          <p className="mt-1 max-w-xs text-xs text-[#888] leading-relaxed">
            The AI voice agent platform for modern revenue teams.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-16 gap-y-2 text-xs text-[#888]">
          <Link href="#features" className="hover:text-black transition-colors">
            Features
          </Link>
          <Link href="/login" className="hover:text-black transition-colors">
            Sign in
          </Link>
          <Link
            href="#how-it-works"
            className="hover:text-black transition-colors"
          >
            How it works
          </Link>
          <Link href="/register" className="hover:text-black transition-colors">
            Get started
          </Link>
          <Link href="#pricing" className="hover:text-black transition-colors">
            Pricing
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-5xl mt-8 border-t border-black/8 pt-6 text-xs text-[#bbb]">
        {/* suppressHydrationWarning: the year is time-derived and can differ
            between the (build/SSR) render and the client across a
            timezone/midnight boundary — the only such node on the page. */}
        <span suppressHydrationWarning>
          &copy; {new Date().getFullYear()} VoiceOS. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
