import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex h-16 items-center justify-between border-b border-[#e0e0e0] px-8">
        <span className="text-lg font-bold tracking-tight">VoiceOS</span>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="secondary" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-8 py-32 text-center">
        <div className="mb-4 inline-flex items-center rounded-full border border-[#e0e0e0] px-3 py-1 text-xs text-[#6b6b6b]">
          Now with ElevenLabs hyper-realistic voices
        </div>
        <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight text-[#0a0a0a] sm:text-6xl">
          The AI Voice Agent Platform That Closes Deals While You Sleep
        </h1>
        <p className="mt-6 max-w-xl text-lg text-[#6b6b6b]">
          Deploy AI voice agents that call your leads, handle objections, book appointments, and convert — 24/7, in 70+
          languages.
        </p>
        <div className="mt-10 flex items-center gap-4">
          <Link href="/register">
            <Button size="lg">Start for free</Button>
          </Link>
          <Link href="#pricing">
            <Button variant="secondary" size="lg">
              See pricing
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-[#e0e0e0] bg-[#f5f5f5] px-8 py-24" id="features">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">Everything you need to scale outreach</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: 'Hyper-Realistic Voices', desc: 'ElevenLabs & Retell AI powered voices with emotional control and 70+ languages.' },
              { title: 'Smart Campaigns', desc: 'Upload CSV, set schedule, launch. Auto-retry, concurrency control, real-time status board.' },
              { title: 'Post-Call Analysis', desc: 'Auto-transcripts, sentiment analysis, QA scoring, extracted leads — on every call.' },
              { title: 'Knowledge Base RAG', desc: 'Upload PDFs, docs, URLs. Agents answer questions with your exact content.' },
              { title: 'CRM Integrations', desc: 'HubSpot, GoHighLevel, Salesforce, Calendly, Zapier, Make and more.' },
              { title: 'White Label Ready', desc: 'Custom domain, your branding, your clients. Scale plan includes full white label.' }
            ].map((f) => (
              <div key={f.title} className="rounded-lg border border-[#e0e0e0] bg-white p-6">
                <h3 className="mb-2 font-semibold">{f.title}</h3>
                <p className="text-sm text-[#6b6b6b]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-8 py-24" id="pricing">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">Simple, transparent pricing</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { name: 'Free', price: '$0', period: 'forever', features: ['1 agent', '50 minutes/mo', 'Basic analytics', 'Email support'], cta: 'Get started', highlight: false },
              { name: 'Pro', price: '$97', period: 'per month', features: ['5 agents', '1,000 minutes/mo', 'Full analytics', 'All integrations', 'Priority support'], cta: 'Start Pro', highlight: true },
              { name: 'Scale', price: '$297', period: 'per month', features: ['Unlimited agents', '5,000 minutes/mo', '+$0.05/extra min', 'White label', 'Custom domain', 'Dedicated support'], cta: 'Go Scale', highlight: false }
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-lg border p-6 ${plan.highlight ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white' : 'border-[#e0e0e0] bg-white text-[#0a0a0a]'}`}
              >
                <div className="mb-4">
                  <div className={`text-sm font-medium ${plan.highlight ? 'text-[#aaa]' : 'text-[#6b6b6b]'}`}>{plan.name}</div>
                  <div className="mt-1 text-3xl font-bold">{plan.price}</div>
                  <div className={`text-sm ${plan.highlight ? 'text-[#aaa]' : 'text-[#6b6b6b]'}`}>{plan.period}</div>
                </div>
                <ul className="mb-6 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className={`text-sm ${plan.highlight ? 'text-[#ddd]' : 'text-[#6b6b6b]'}`}>
                      ✓ {f}
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

      {/* Footer */}
      <footer className="border-t border-[#e0e0e0] px-8 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="font-bold">VoiceOS</span>
          <p className="text-sm text-[#6b6b6b]">© {new Date().getFullYear()} VoiceOS. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
