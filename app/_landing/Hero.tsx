import Link from "next/link";
import { SERIF } from "./data";

export function Hero() {
  return (
    <section className="bg-white px-6 pb-32 pt-24 sm:px-12 lg:pt-36 lg:pb-40">
      <div className="mx-auto max-w-5xl">
        <p className="mb-8 text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
          AI Voice Platform
        </p>
        <h1
          className="max-w-3xl text-5xl font-light leading-[1.08] tracking-tight text-black sm:text-6xl lg:text-7xl"
          style={SERIF}
        >
          AI Voice Agents That
          <br />
          Close Deals While
          <br />
          You Sleep
        </h1>
        <p className="mt-10 max-w-lg text-base leading-relaxed text-[#555]">
          Deploy AI voice agents that call your leads, handle objections, book
          appointments, and convert — 24/7, in 70+ languages. No code. No
          hiring. No limits.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/register">
            <button className="border border-black bg-black px-8 py-3 text-sm font-medium text-white hover:bg-[#222] transition-colors">
              Start for free — no card needed
            </button>
          </Link>
          <Link href="#how-it-works">
            <button className="border border-black/20 bg-transparent px-8 py-3 text-sm font-medium text-black hover:border-black transition-colors">
              See how it works
            </button>
          </Link>
        </div>
        <p className="mt-4 text-xs text-[#888]">
          Free plan includes 50 minutes/month.
        </p>
      </div>
    </section>
  );
}
