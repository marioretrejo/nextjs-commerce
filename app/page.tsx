import { Button } from '@/components/ui/button';
import Link from 'next/link';

const FEATURES = [
  {
    icon: '🎙️',
    title: 'Hyper-Realistic Voices',
    desc: 'ElevenLabs & Retell AI powered voices with emotional control, custom cloning, and 70+ languages.',
  },
  {
    icon: '📋',
    title: 'Smart Campaigns',
    desc: 'Upload CSV, set schedule, launch. Auto-retry, concurrency control, live status board per contact.',
  },
  {
    icon: '📊',
    title: 'Post-Call Intelligence',
    desc: 'Auto-transcripts, sentiment scoring, QA grading, and structured data extracted on every call.',
  },
  {
    icon: '📚',
    title: 'Knowledge Base RAG',
    desc: 'Upload PDFs, docs, and URLs. Agents answer questions using your exact content — no hallucinations.',
  },
  {
    icon: '🔗',
    title: 'CRM Integrations',
    desc: 'HubSpot, GoHighLevel, Salesforce, Calendly, Zapier, Make, Google Calendar and more.',
  },
  {
    icon: '🏷️',
    title: 'White Label Ready',
    desc: 'Custom domain, your branding, your clients — without building anything. Scale plan only.',
  },
];

const STATS = [
  { value: '70+', label: 'Languages supported' },
  { value: '10M+', label: 'Calls processed' },
  { value: '< 500ms', label: 'Average response latency' },
  { value: '99.9%', label: 'Uptime SLA' },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Build your agent',
    desc: 'Choose a voice, write a system prompt, upload your knowledge base. Done in minutes.',
  },
  {
    step: '02',
    title: 'Upload your leads',
    desc: 'Drop a CSV with contact names, phones, and custom variables. We handle the rest.',
  },
  {
    step: '03',
    title: 'Launch & monitor',
    desc: 'Watch calls happen in real-time. Every transcript, recording, and outcome logged automatically.',
  },
];

const TESTIMONIALS = [
  {
    quote: 'We went from 200 dials/day to 2,000 — with better conversation quality than our human SDRs.',
    author: 'Marco R.',
    role: 'VP Sales, SaaS startup',
  },
  {
    quote: 'Set up a campaign on Friday, woke up Monday with 47 booked appointments. Insane ROI.',
    author: 'Sofia L.',
    role: 'Founder, Real estate agency',
  },
  {
    quote: 'The QA scoring alone saved us from bad calls reaching our CRM. Game changer.',
    author: 'Daniel K.',
    role: 'Head of Revenue Ops',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-[#0a0a0a]">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[#e0e0e0] bg-white/90 px-6 backdrop-blur-sm sm:px-10">
        <span className="text-lg font-bold tracking-tight">VoiceOS</span>
        <div className="hidden items-center gap-8 text-sm text-[#6b6b6b] sm:flex">
          <Link href="#features" className="hover:text-[#0a0a0a] transition-colors">Features</Link>
          <Link href="#how-it-works" className="hover:text-[#0a0a0a] transition-colors">How it works</Link>
          <Link href="#pricing" className="hover:text-[#0a0a0a] transition-colors">Pricing</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="secondary" size="sm">Sign in</Button>
          </Link>
          <Link href="/register">
            <Button size="sm">Get started free</Button>
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-6 pb-24 pt-20 text-center sm:px-10">
        {/* subtle grid background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#0a0a0a 1px,transparent 1px),linear-gradient(90deg,#0a0a0a 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative mx-auto max-w-4xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e0e0e0] bg-[#f5f5f5] px-3.5 py-1.5 text-xs font-medium text-[#6b6b6b]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0a0a0a]" />
            Now with ElevenLabs hyper-realistic voice cloning
          </div>
          <h1 className="text-5xl font-bold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
            AI Voice Agents That<br />
            <span className="relative">
              Close Deals
              <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 300 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 6C50 2 100 2 150 4C200 6 250 6 298 4" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </span>{' '}
            While You Sleep
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg text-[#6b6b6b]">
            Deploy AI voice agents that call your leads, handle objections, book appointments, and convert — 24/7, in 70+ languages.
            No code. No hiring. No limits.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/register">
              <Button size="lg" className="h-12 px-8 text-base">
                Start for free — no card needed
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button variant="secondary" size="lg" className="h-12 px-8 text-base">
                See how it works
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-[#6b6b6b]">Free plan includes 50 minutes/month. No credit card required.</p>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y border-[#e0e0e0] bg-[#f5f5f5] px-6 py-12 sm:px-10">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold tracking-tight">{s.value}</p>
              <p className="mt-1 text-sm text-[#6b6b6b]">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 py-24 sm:px-10" id="features">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-[#6b6b6b]">Platform</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to scale outreach
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="group rounded-xl border border-[#e0e0e0] bg-white p-6 transition-shadow hover:shadow-sm">
                <div className="mb-3 text-2xl">{f.icon}</div>
                <h3 className="mb-1.5 font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-[#6b6b6b]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-[#e0e0e0] bg-[#f5f5f5] px-6 py-24 sm:px-10" id="how-it-works">
        <div className="mx-auto max-w-4xl">
          <div className="mb-14 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-[#6b6b6b]">Process</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Live in under 10 minutes</h2>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map((h, i) => (
              <div key={h.step} className="relative">
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="absolute right-0 top-6 hidden h-px w-full border-t border-dashed border-[#e0e0e0] md:block" style={{ right: '-50%', width: '50%' }} />
                )}
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#0a0a0a] text-sm font-bold text-white">
                  {h.step}
                </div>
                <h3 className="mb-2 font-semibold">{h.title}</h3>
                <p className="text-sm leading-relaxed text-[#6b6b6b]">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="px-6 py-24 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-[#6b6b6b]">Social proof</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Trusted by revenue teams worldwide
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.author} className="rounded-xl border border-[#e0e0e0] bg-white p-6">
                <div className="mb-4 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} viewBox="0 0 12 12" className="h-4 w-4 fill-[#0a0a0a]">
                      <path d="M6 0l1.5 4H12L8.5 6.5 10 11 6 8.5 2 11l1.5-4.5L0 4h4.5z" />
                    </svg>
                  ))}
                </div>
                <p className="mb-4 text-sm leading-relaxed text-[#0a0a0a]">&ldquo;{t.quote}&rdquo;</p>
                <div>
                  <p className="text-sm font-semibold">{t.author}</p>
                  <p className="text-xs text-[#6b6b6b]">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="border-t border-[#e0e0e0] bg-[#f5f5f5] px-6 py-24 sm:px-10" id="pricing">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-[#6b6b6b]">Pricing</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Simple, transparent pricing</h2>
            <p className="mt-3 text-[#6b6b6b]">Start free. Scale when you&apos;re ready. Cancel anytime.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                name: 'Free',
                price: '$0',
                period: 'forever',
                desc: 'Perfect for testing your first agent.',
                features: ['1 AI agent', '50 minutes / month', 'Basic analytics', 'Community support'],
                cta: 'Get started free',
                highlight: false,
              },
              {
                name: 'Pro',
                price: '$97',
                period: 'per month',
                desc: 'For growing teams scaling outreach.',
                features: [
                  '5 AI agents',
                  '1,000 minutes / month',
                  'Full analytics + QA scoring',
                  'All CRM integrations',
                  'Knowledge base (RAG)',
                  'Priority support',
                ],
                cta: 'Start Pro',
                highlight: true,
              },
              {
                name: 'Scale',
                price: '$297',
                period: 'per month',
                desc: 'For agencies and enterprises.',
                features: [
                  'Unlimited agents',
                  '5,000 minutes / month',
                  '+$0.05 per extra minute',
                  'White label + custom domain',
                  'Dedicated account manager',
                  'SLA guarantee',
                ],
                cta: 'Go Scale',
                highlight: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-xl border p-7 ${
                  plan.highlight
                    ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white shadow-lg'
                    : 'border-[#e0e0e0] bg-white text-[#0a0a0a]'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-0.5 text-xs font-semibold text-[#0a0a0a] shadow">
                    Most popular
                  </div>
                )}
                <p className={`text-sm font-medium ${plan.highlight ? 'text-[#aaa]' : 'text-[#6b6b6b]'}`}>{plan.name}</p>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.price !== '$0' && (
                    <span className={`mb-1 text-sm ${plan.highlight ? 'text-[#aaa]' : 'text-[#6b6b6b]'}`}>/{plan.period.split(' ')[0]}</span>
                  )}
                </div>
                <p className={`mt-1 text-xs ${plan.highlight ? 'text-[#aaa]' : 'text-[#6b6b6b]'}`}>{plan.desc}</p>
                <ul className="my-6 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2 text-sm ${plan.highlight ? 'text-[#ddd]' : 'text-[#6b6b6b]'}`}>
                      <span className={`mt-0.5 shrink-0 font-bold ${plan.highlight ? 'text-white' : 'text-[#0a0a0a]'}`}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button
                    className="w-full"
                    variant={plan.highlight ? 'secondary' : 'default'}
                    style={plan.highlight ? { background: 'white', color: '#0a0a0a' } : {}}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 py-24 text-center sm:px-10">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to 10x your outreach?
          </h2>
          <p className="mt-4 text-lg text-[#6b6b6b]">
            Join thousands of sales teams using VoiceOS to close more deals on autopilot.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/register">
              <Button size="lg" className="h-12 px-8 text-base">
                Start for free
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="lg" className="h-12 px-8 text-base">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#e0e0e0] px-6 py-10 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-start justify-between gap-8 sm:flex-row">
            <div>
              <span className="text-base font-bold">VoiceOS</span>
              <p className="mt-1 max-w-xs text-sm text-[#6b6b6b]">
                The AI voice agent platform for modern revenue teams.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-16 gap-y-2 text-sm text-[#6b6b6b]">
              <Link href="#features" className="hover:text-[#0a0a0a] transition-colors">Features</Link>
              <Link href="/login" className="hover:text-[#0a0a0a] transition-colors">Sign in</Link>
              <Link href="#how-it-works" className="hover:text-[#0a0a0a] transition-colors">How it works</Link>
              <Link href="/register" className="hover:text-[#0a0a0a] transition-colors">Get started</Link>
              <Link href="#pricing" className="hover:text-[#0a0a0a] transition-colors">Pricing</Link>
            </div>
          </div>
          <div className="mt-8 border-t border-[#e0e0e0] pt-6 text-center text-xs text-[#6b6b6b]">
            © {new Date().getFullYear()} VoiceOS. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
