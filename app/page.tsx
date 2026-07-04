import Link from "next/link";

const SOCIAL_PROOF_LOGOS = [
  "TechCorp",
  "GrowthCo",
  "SalesForce Inc.",
  "LeadGen Pro",
  "RevOps HQ",
  "DialMax",
  "OutreachPro",
];

const FAQ = [
  {
    q: "How is VoiceOS different from regular auto-dialers?",
    a: "VoiceOS uses large language models and ultra-realistic AI voices to hold genuine two-way conversations. Unlike dialers that play pre-recorded messages, our agents understand responses, handle objections, ask follow-up questions, and adapt in real-time.",
  },
  {
    q: "Is this compliant with TCPA and GDPR?",
    a: "VoiceOS includes a built-in Compliance Center with DNC list management, configurable calling hours, consent tracking, and data retention policies. You remain responsible for ensuring your use case meets local regulations, but we give you all the controls.",
  },
  {
    q: "What languages are supported?",
    a: "We support 70+ languages through our Deepgram (speech-to-text) and Cartesia (text-to-speech) voice pipeline. You can configure a primary language per agent and enable auto-detection to match the caller's language on the first turn.",
  },
  {
    q: "Can I use my own phone numbers?",
    a: "Yes. VoiceOS supports Twilio BYOC and Telnyx BYO number so you can port your existing numbers. Alternatively, provision new numbers directly inside the platform in 16+ countries.",
  },
  {
    q: "How does billing work for extra minutes?",
    a: "Free plan includes 50 minutes/month. Pro includes 1,000 minutes. Scale includes 5,000 minutes. Additional minutes on Scale are billed at $0.05/minute. No surprise charges — you'll get an alert at 80% and 100% usage.",
  },
  {
    q: "Can I embed the voice agent on my website?",
    a: "Yes. Every agent has a built-in web widget that you can embed via a single script tag or iframe. Visitors can start a voice call directly in the browser with no phone needed.",
  },
];

const FEATURES = [
  {
    index: "01",
    title: "Hyper-Realistic Voices",
    desc: "Cartesia-powered voices with emotional control, custom cloning, and 70+ languages.",
  },
  {
    index: "02",
    title: "Smart Campaigns",
    desc: "Upload CSV, set schedule, launch. Auto-retry, concurrency control, live status board per contact.",
  },
  {
    index: "03",
    title: "Post-Call Intelligence",
    desc: "Auto-transcripts, sentiment scoring, QA grading, and structured data extracted on every call.",
  },
  {
    index: "04",
    title: "Knowledge Base RAG",
    desc: "Upload PDFs, docs, and URLs. Agents answer questions using your exact content — no hallucinations.",
  },
  {
    index: "05",
    title: "CRM Integrations",
    desc: "HubSpot, GoHighLevel, Salesforce, Calendly, Zapier, Make, Google Calendar and more.",
  },
  {
    index: "06",
    title: "White Label Ready",
    desc: "Custom domain, your branding, your clients — without building anything. Scale plan only.",
  },
];

const STATS = [
  { value: "70+", label: "Languages" },
  { value: "10M+", label: "Calls processed" },
  { value: "< 500ms", label: "Avg. latency" },
  { value: "99.9%", label: "Uptime SLA" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Build your agent",
    desc: "Choose a voice, write a system prompt, upload your knowledge base. Done in minutes.",
  },
  {
    step: "02",
    title: "Upload your leads",
    desc: "Drop a CSV with contact names, phones, and custom variables. We handle the rest.",
  },
  {
    step: "03",
    title: "Launch & monitor",
    desc: "Watch calls happen in real-time. Every transcript, recording, and outcome logged automatically.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "We went from 200 dials/day to 2,000 — with better conversation quality than our human SDRs.",
    author: "Marco R.",
    role: "VP Sales, SaaS startup",
  },
  {
    quote:
      "Set up a campaign on Friday, woke up Monday with 47 booked appointments. Insane ROI.",
    author: "Sofia L.",
    role: "Founder, Real estate agency",
  },
  {
    quote:
      "The QA scoring alone saved us from bad calls reaching our CRM. Game changer.",
    author: "Daniel K.",
    role: "Head of Revenue Ops",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      {/* Nav */}
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

      {/* Hero */}
      <section className="bg-white px-6 pb-32 pt-24 sm:px-12 lg:pt-36 lg:pb-40">
        <div className="mx-auto max-w-5xl">
          <p className="mb-8 text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
            AI Voice Platform
          </p>
          <h1
            className="max-w-3xl text-5xl font-light leading-[1.08] tracking-tight text-black sm:text-6xl lg:text-7xl"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
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

      {/* Social Proof */}
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

      {/* Stats */}
      <section className="border-b border-black/8 bg-white px-6 py-16 sm:px-12">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-12 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <p
                className="text-4xl font-light tracking-tight text-black"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
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

      {/* Features */}
      <section className="bg-white px-6 py-28 sm:px-12" id="features">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 flex items-end justify-between border-b border-black/10 pb-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
              Platform
            </p>
            <h2
              className="text-2xl font-light tracking-tight sm:text-3xl text-black"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
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

      {/* How it works */}
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
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              Live in under 10 minutes
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
            {HOW_IT_WORKS.map((h) => (
              <div key={h.step}>
                <p
                  className="mb-5 text-5xl font-light text-[#ccc]"
                  style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
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

      {/* Demo */}
      <section className="border-t border-black/8 bg-white px-6 py-20 sm:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
            Live demo
          </p>
          <h2
            className="mb-10 text-2xl font-light tracking-tight sm:text-3xl text-black"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
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

      {/* Testimonials */}
      <section className="border-t border-black/8 bg-[#f2f2f2] px-6 py-28 sm:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 flex items-end justify-between border-b border-black/10 pb-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
              Social proof
            </p>
            <h2
              className="text-2xl font-light tracking-tight sm:text-3xl text-black"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
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

      {/* Pricing */}
      <section
        className="border-t border-black/8 bg-white px-6 py-28 sm:px-12"
        id="pricing"
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 flex items-end justify-between border-b border-black/10 pb-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
              Pricing
            </p>
            <h2
              className="text-2xl font-light tracking-tight sm:text-3xl text-black"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              Simple, transparent pricing
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-0 sm:grid-cols-3 border border-black/15">
            {[
              {
                name: "Free",
                price: "$0",
                period: "forever",
                desc: "Perfect for testing your first agent.",
                features: [
                  "1 AI agent",
                  "50 minutes / month",
                  "Basic analytics",
                  "Community support",
                ],
                cta: "Get started free",
                highlight: false,
              },
              {
                name: "Pro",
                price: "$97",
                period: "per month",
                desc: "For growing teams scaling outreach.",
                features: [
                  "5 AI agents",
                  "1,000 minutes / month",
                  "Full analytics + QA scoring",
                  "All CRM integrations",
                  "Knowledge base (RAG)",
                  "Priority support",
                ],
                cta: "Start Pro",
                highlight: true,
              },
              {
                name: "Scale",
                price: "$297",
                period: "per month",
                desc: "For agencies and enterprises.",
                features: [
                  "Unlimited agents",
                  "5,000 minutes / month",
                  "+$0.05 per extra minute",
                  "White label + custom domain",
                  "Dedicated account manager",
                  "SLA guarantee",
                ],
                cta: "Go Scale",
                highlight: false,
              },
            ].map((plan, i) => (
              <div
                key={plan.name}
                className={`relative p-8 ${
                  plan.highlight ? "bg-black text-white" : "bg-white text-black"
                } ${i > 0 ? "border-l border-black/15" : ""}`}
              >
                {plan.highlight && (
                  <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-[#888]">
                    Most popular
                  </p>
                )}
                <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[#888]">
                  {plan.name}
                </p>
                <div className="mt-3 flex items-end gap-1">
                  <span
                    className="text-4xl font-light"
                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                  >
                    {plan.price}
                  </span>
                  {plan.price !== "$0" && (
                    <span
                      className={`mb-1 text-xs ${plan.highlight ? "text-[#888]" : "text-[#888]"}`}
                    >
                      /{plan.period.split(" ")[0]}
                    </span>
                  )}
                </div>
                <p
                  className={`mt-2 text-xs ${plan.highlight ? "text-[#888]" : "text-[#888]"}`}
                >
                  {plan.desc}
                </p>
                <ul className="my-7 space-y-2.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className={`flex items-start gap-2 text-xs leading-relaxed ${plan.highlight ? "text-[#bbb]" : "text-[#555]"}`}
                    >
                      <span
                        className={`mt-0.5 shrink-0 ${plan.highlight ? "text-white" : "text-black"}`}
                      >
                        -
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <button
                    className={`w-full border py-2.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                      plan.highlight
                        ? "border-white bg-white text-black hover:bg-[#f2f2f2]"
                        : "border-black bg-transparent text-black hover:bg-black hover:text-white"
                    }`}
                  >
                    {plan.cta}
                  </button>
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs text-[#888]">
            Start free. Scale when you&apos;re ready. Cancel anytime.
          </p>
        </div>
      </section>

      {/* FAQ */}
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
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
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

      {/* Final CTA */}
      <section className="border-t border-black/8 bg-white px-6 py-32 sm:px-12">
        <div className="mx-auto max-w-5xl">
          <p className="mb-6 text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
            Get started
          </p>
          <h2
            className="mb-10 max-w-2xl text-4xl font-light leading-tight tracking-tight text-black sm:text-5xl"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
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

      {/* Footer */}
      <footer className="border-t border-black/8 bg-white px-6 py-10 sm:px-12">
        <div className="mx-auto max-w-5xl flex flex-col items-start justify-between gap-8 sm:flex-row">
          <div>
            <span className="text-sm font-semibold text-black">VoiceOS</span>
            <p className="mt-1 max-w-xs text-xs text-[#888] leading-relaxed">
              The AI voice agent platform for modern revenue teams.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-16 gap-y-2 text-xs text-[#888]">
            <Link
              href="#features"
              className="hover:text-black transition-colors"
            >
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
            <Link
              href="/register"
              className="hover:text-black transition-colors"
            >
              Get started
            </Link>
            <Link
              href="#pricing"
              className="hover:text-black transition-colors"
            >
              Pricing
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-5xl mt-8 border-t border-black/8 pt-6 text-xs text-[#bbb]">
          &copy; {new Date().getFullYear()} VoiceOS. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
