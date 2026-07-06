import {
  SOCIAL_PROOF_LOGOS,
  STATS,
  FEATURES,
  HOW_IT_WORKS,
  TESTIMONIALS,
  SERIF,
} from "./data";

export function SocialProof() {
  return (
    <section className="border-y border-black/8 bg-[#f2f2f2] px-6 py-8 sm:px-12">
      <div className="mx-auto max-w-5xl">
        <p className="mb-5 text-[10px] font-medium uppercase tracking-[0.2em] text-[#888]">
          Trusted by revenue teams at
        </p>
        <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
          {SOCIAL_PROOF_LOGOS.map((name) => (
            <span
              key={name}
              className="text-xs font-medium text-[#bbb] tracking-wide select-none"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StatsSection() {
  return (
    <section className="border-b border-black/8 bg-white px-6 py-16 sm:px-12">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-12 md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label}>
            <p
              className="text-4xl font-light tracking-tight text-black"
              style={SERIF}
            >
              {s.value}
            </p>
            <p className="mt-1 text-xs text-[#888] uppercase tracking-wider">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section className="bg-white px-6 py-28 sm:px-12" id="features">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 flex items-end justify-between border-b border-black/10 pb-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
            Platform
          </p>
          <h2
            className="text-2xl font-light tracking-tight sm:text-3xl text-black"
            style={SERIF}
          >
            Everything you need to scale outreach
          </h2>
        </div>
        <div className="divide-y divide-black/8">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="grid grid-cols-[40px_1fr_2fr] items-start gap-8 py-8 sm:py-10"
            >
              <span className="text-xs font-medium text-[#bbb] pt-0.5">
                {f.index}
              </span>
              <h3 className="text-sm font-semibold text-black">{f.title}</h3>
              <p className="text-sm leading-relaxed text-[#555]">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section
      className="border-t border-black/8 bg-[#f2f2f2] px-6 py-28 sm:px-12"
      id="how-it-works"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 flex items-end justify-between border-b border-black/10 pb-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
            Process
          </p>
          <h2
            className="text-2xl font-light tracking-tight sm:text-3xl text-black"
            style={SERIF}
          >
            Live in under 10 minutes
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
          {HOW_IT_WORKS.map((h) => (
            <div key={h.step}>
              <p className="mb-5 text-5xl font-light text-[#ccc]" style={SERIF}>
                {h.step}
              </p>
              <h3 className="mb-2 text-sm font-semibold text-black">
                {h.title}
              </h3>
              <p className="text-sm leading-relaxed text-[#555]">{h.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Demo() {
  return (
    <section className="border-t border-black/8 bg-white px-6 py-20 sm:px-12">
      <div className="mx-auto max-w-3xl">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
          Live demo
        </p>
        <h2
          className="mb-10 text-2xl font-light tracking-tight sm:text-3xl text-black"
          style={SERIF}
        >
          See it in action
        </h2>
        <div className="relative aspect-video border border-black/15 bg-[#f2f2f2] flex flex-col items-center justify-center gap-4 cursor-pointer group hover:border-black/40 transition-colors">
          <div className="flex h-14 w-14 items-center justify-center border border-black bg-black text-white group-hover:bg-[#222] transition-colors">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5 ml-0.5"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <p className="text-xs text-[#888]">Watch a 2-minute product demo</p>
        </div>
      </div>
    </section>
  );
}

export function Testimonials() {
  return (
    <section className="border-t border-black/8 bg-[#f2f2f2] px-6 py-28 sm:px-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 flex items-end justify-between border-b border-black/10 pb-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
            Social proof
          </p>
          <h2
            className="text-2xl font-light tracking-tight sm:text-3xl text-black"
            style={SERIF}
          >
            Trusted by revenue teams worldwide
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.author} className="border-t-2 border-black pt-6">
              <p className="mb-6 text-sm leading-relaxed text-[#333]">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-black">
                  {t.author}
                </p>
                <p className="mt-0.5 text-xs text-[#888]">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
