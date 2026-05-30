'use client';

import {
  ShieldCheck,
  Globe,
  Server,
  Clock3,
  Lock,
  Headphones,
  Cookie,
} from 'lucide-react';

// ── Inline SVG logos ──────────────────────────────────────────────────────────

const SlackLogo = () => (
  <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7" aria-label="Slack">
    <rect width="32" height="32" rx="7" fill="#4A154B" />
    <path d="M11 17.5a2.5 2.5 0 0 1-2.5-2.5 2.5 2.5 0 0 1 2.5-2.5h2.5V15a2.5 2.5 0 0 1-2.5 2.5Zm0 2a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z" fill="#E01E5A" />
    <path d="M17.5 11a2.5 2.5 0 0 1-2.5-2.5 2.5 2.5 0 0 1 2.5-2.5 2.5 2.5 0 0 1 2.5 2.5V11h-2.5Zm0 2a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z" fill="#36C5F0" />
    <path d="M21 17.5a2.5 2.5 0 0 1 2.5-2.5 2.5 2.5 0 0 1 2.5 2.5 2.5 2.5 0 0 1-2.5 2.5H21V17.5Zm-2 0a4.5 4.5 0 1 0 9 0 4.5 4.5 0 0 0-9 0Z" fill="#2EB67D" />
    <path d="M14.5 21a2.5 2.5 0 0 1 2.5 2.5 2.5 2.5 0 0 1-2.5 2.5 2.5 2.5 0 0 1-2.5-2.5V21h2.5Zm0-2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" fill="#ECB22E" />
  </svg>
);

const NotionLogo = () => (
  <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7" aria-label="Notion">
    <rect width="32" height="32" rx="7" fill="#ffffff" stroke="#e5e5e5" strokeWidth="1" />
    <path d="M8 8.5C8 7.67 8.67 7 9.5 7h10.89c.49 0 .96.19 1.31.54l3.11 3.11c.35.35.54.82.54 1.31V24c0 .83-.67 1.5-1.5 1.5H9.5C8.67 25.5 8 24.83 8 24V8.5Z" fill="#1a1a1a" />
    <path d="M11 12l2.5 3.5L16 12h2l-3.5 5 3.5 5h-2l-2.5-3.5L11 22H9l3.5-5L9 12h2Z" fill="white" />
  </svg>
);

const MondayLogo = () => (
  <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7" aria-label="Monday">
    <rect width="32" height="32" rx="7" fill="#F4511E" />
    <ellipse cx="9" cy="17" rx="3.5" ry="3.5" fill="#FF642E" />
    <ellipse cx="16" cy="13" rx="3.5" ry="3.5" fill="#FFCC00" />
    <ellipse cx="23" cy="17" rx="3.5" ry="3.5" fill="#00CA72" />
    <ellipse cx="9" cy="17" rx="3" ry="3" fill="white" fillOpacity="0.9" />
    <ellipse cx="16" cy="13" rx="3" ry="3" fill="white" fillOpacity="0.85" />
    <ellipse cx="23" cy="17" rx="3" ry="3" fill="white" fillOpacity="0.9" />
    <ellipse cx="9" cy="17" rx="3" ry="3" fill="#FF3D0080" />
    <ellipse cx="16" cy="13" rx="3" ry="3" fill="#FFCB0080" />
    <ellipse cx="23" cy="17" rx="3" ry="3" fill="#00C97280" />
  </svg>
);

const StripeLogo = () => (
  <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7" aria-label="Stripe">
    <rect width="32" height="32" rx="7" fill="#6772E5" />
    <path d="M15.5 12.4c0-.85.7-1.2 1.75-1.2 1.55 0 3.5.5 5 1.3V8.3C20.7 7.5 19.15 7 16.75 7c-4.3 0-7.25 2.2-7.25 5.85 0 5.7 7.85 4.8 7.85 7.25 0 1-.85 1.35-2 1.35-1.7 0-3.9-.7-5.65-1.65v4.25A14.1 14.1 0 0 0 15.25 25c4.4 0 7.45-2.1 7.45-5.85-.1-6.2-7.2-5.05-7.2-6.75Z" fill="white" />
  </svg>
);

const GitHubLogo = () => (
  <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7" aria-label="GitHub">
    <rect width="32" height="32" rx="7" fill="#24292F" />
    <path fillRule="evenodd" clipRule="evenodd" d="M16 6a10 10 0 0 0-3.162 19.494c.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.646 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 16 9.82a9.58 9.58 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.376.202 2.394.1 2.646.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481A10.001 10.001 0 0 0 16 6Z" fill="white" />
  </svg>
);

const ZapierLogo = () => (
  <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7" aria-label="Zapier">
    <rect width="32" height="32" rx="7" fill="#FF4A00" />
    <path d="M16.5 7 8 16.5h7L8 25h1.5L25 15.5h-7L25 7h-8.5Z" fill="white" />
  </svg>
);

const TwilioLogo = () => (
  <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7" aria-label="Twilio">
    <rect width="32" height="32" rx="7" fill="#F22F46" />
    <circle cx="16" cy="16" r="7" stroke="white" strokeWidth="2" fill="none" />
    <circle cx="13" cy="13" r="1.8" fill="white" />
    <circle cx="19" cy="13" r="1.8" fill="white" />
    <circle cx="13" cy="19" r="1.8" fill="white" />
    <circle cx="19" cy="19" r="1.8" fill="white" />
  </svg>
);

const HubSpotLogo = () => (
  <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7" aria-label="HubSpot">
    <rect width="32" height="32" rx="7" fill="#FF7A59" />
    <circle cx="19.5" cy="12.5" r="3" fill="white" />
    <path d="M19.5 15.5v2M15.5 12.5H8M16.5 18.5c0 2.2-1.8 4-4 4s-4-1.8-4-4 1.8-4 4-4 4 1.8 4 4Z" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const SalesforceLogo = () => (
  <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7" aria-label="Salesforce">
    <rect width="32" height="32" rx="7" fill="#00A1E0" />
    <path d="M13 10a4 4 0 0 1 3.5 2.07A3.5 3.5 0 0 1 22 15.5a3.5 3.5 0 0 1-3.5 3.5H11a3 3 0 1 1 2-5.2A4 4 0 0 1 13 10Z" fill="white" />
  </svg>
);

const OpenAILogo = () => (
  <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7" aria-label="OpenAI">
    <rect width="32" height="32" rx="7" fill="#0a0a0a" />
    <path d="M24 16a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM16 11l1.5 4.5L22 17l-4.5 1.5L16 23l-1.5-4.5L10 17l4.5-1.5L16 11Z" fill="white" fillOpacity="0.85" />
  </svg>
);

// ── Logo list ─────────────────────────────────────────────────────────────────

import type { ReactElement } from 'react';

interface LogoItem { name: string; Logo: () => ReactElement }

const LOGOS: LogoItem[] = [
  { name: 'Slack',      Logo: SlackLogo },
  { name: 'Notion',     Logo: NotionLogo },
  { name: 'Monday',     Logo: MondayLogo },
  { name: 'Stripe',     Logo: StripeLogo },
  { name: 'GitHub',     Logo: GitHubLogo },
  { name: 'Zapier',     Logo: ZapierLogo },
  { name: 'Twilio',     Logo: TwilioLogo },
  { name: 'HubSpot',    Logo: HubSpotLogo },
  { name: 'Salesforce', Logo: SalesforceLogo },
  { name: 'OpenAI',     Logo: OpenAILogo },
];

// ── Enterprise feature cards ──────────────────────────────────────────────────

const FEATURES = [
  {
    Icon: Clock3,
    title: 'Support SLA',
    description: 'Guaranteed sub-hour response times with 24/7 priority support and a dedicated account manager for every enterprise customer.',
  },
  {
    Icon: Headphones,
    title: 'Dedicated Deployment Support',
    description: 'White-glove onboarding with dedicated engineers who help you integrate, configure, and scale your voice AI deployment from day one.',
  },
  {
    Icon: Server,
    title: 'Scalable Infrastructure',
    description: 'Auto-scaling architecture built for millions of concurrent calls, with 99.99% uptime SLAs and real-time failover across regions.',
  },
  {
    Icon: ShieldCheck,
    title: 'SOC 2 Type II Certified',
    description: 'End-to-end encryption, GDPR compliance, HIPAA-ready data handling, and annual third-party security audits included.',
  },
  {
    Icon: Globe,
    title: 'Global Coverage',
    description: 'Deploy voice agents in 40+ countries with regional routing, ultra-low-latency delivery, and local DID provisioning.',
  },
  {
    Icon: Lock,
    title: 'Role-Based Access Control',
    description: 'Fine-grained permissions, SSO/SAML, immutable audit logs, and custom data-retention policies — all configurable per workspace.',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function IntegrationsSection() {
  // Two copies → seamless loop (animate slides exactly -50%)
  const row1 = [...LOGOS, ...LOGOS];
  const row2 = [...LOGOS].reverse().concat([...LOGOS].reverse());

  return (
    <>
      {/* ── SECTION 1 · Integrations ── */}
      <section className="bg-[#0a0a0a] pt-24 pb-20 overflow-hidden">

        {/* Header */}
        <div className="mx-auto max-w-3xl px-6 text-center mb-16">
          <p className="text-[10px] font-semibold tracking-[0.35em] uppercase text-[#555] mb-4">
            Integrations
          </p>
          <h2
            className="text-4xl sm:text-5xl font-bold text-white leading-tight"
            style={{ letterSpacing: '-0.03em' }}
          >
            API‑first by design
          </h2>
          <p className="mt-5 text-[#666] text-base leading-relaxed max-w-md mx-auto">
            Connect to any workflow. Plug VoiceOS into your existing stack in
            minutes with REST, webhooks, or native connectors.
          </p>
        </div>

        {/* Row 1 — left to right */}
        <MarqueeRow items={row1} direction="forward" />

        {/* Row 2 — right to left */}
        <div className="mt-4">
          <MarqueeRow items={row2} direction="reverse" />
        </div>

        {/* Bottom connector dots */}
        <div className="mt-16 flex justify-center gap-2">
          {[...Array(5)].map((_, i) => (
            <span
              key={i}
              className="inline-block rounded-full bg-[#222]"
              style={{ width: i === 2 ? 18 : 6, height: 6 }}
            />
          ))}
        </div>
      </section>

      {/* ── SECTION 2 · Enterprise ── */}
      <section className="bg-[#f8f8f8] py-24 px-6 relative overflow-hidden">

        {/* Subtle dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle, #c0c0c0 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative mx-auto max-w-6xl">

          {/* Header */}
          <div className="text-center mb-16">
            <p className="text-[10px] font-semibold tracking-[0.35em] uppercase text-[#aaa] mb-4">
              Built for enterprises
            </p>
            <h2
              className="text-4xl sm:text-5xl font-bold text-[#0a0a0a] leading-tight"
              style={{ letterSpacing: '-0.03em' }}
            >
              Enterprise‑ready capabilities
            </h2>
            <p className="mt-5 text-[#777] text-base leading-relaxed max-w-md mx-auto">
              Everything your team needs to deploy voice AI at scale — with the
              security and reliability your business demands.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ Icon, title, description }, i) => (
              <div
                key={i}
                className="group relative bg-white rounded-2xl p-6 border border-[#e8e8e8] hover:border-[#d0d0d0] hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-default overflow-hidden"
              >
                {/* Top accent line on hover */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0a0a0a]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-[#f4f4f4] group-hover:bg-[#0a0a0a] flex items-center justify-center mb-4 transition-colors duration-200">
                  <Icon className="w-5 h-5 text-[#666] group-hover:text-white transition-colors duration-200" />
                </div>

                <h3 className="font-semibold text-[#0a0a0a] mb-2 text-[14.5px] tracking-tight">
                  {title}
                </h3>
                <p className="text-[#888] text-[13px] leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>

          {/* CTA row */}
          <div className="mt-14 text-center">
            <button className="inline-flex items-center gap-2 bg-[#0a0a0a] text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#222] transition-colors duration-150">
              Talk to Sales
              <span aria-hidden>→</span>
            </button>
            <p className="mt-3 text-[12px] text-[#aaa]">
              Custom pricing · Dedicated SLA · Onboarding included
            </p>
          </div>
        </div>

        {/* Decorative cookie — bottom-right corner */}
        <div className="pointer-events-none absolute bottom-6 right-6 opacity-[0.07]">
          <Cookie className="w-20 h-20 text-[#0a0a0a]" />
        </div>
      </section>

      {/* ── Custom animation styles ── */}
      <style>{`
        @layer utilities {
          .animate-marquee {
            animation: voiceos-marquee 32s linear infinite;
          }
          .animate-marquee-reverse {
            animation: voiceos-marquee-reverse 38s linear infinite;
          }
        }

        @keyframes voiceos-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }

        @keyframes voiceos-marquee-reverse {
          from { transform: translateX(-50%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

// ── Sub-component: a single marquee row ───────────────────────────────────────

function MarqueeRow({
  items,
  direction,
}: {
  items: LogoItem[];
  direction: 'forward' | 'reverse';
}) {
  return (
    <div className="relative w-full overflow-hidden">
      {/* Fade masks */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10" />

      <div
        className={`flex gap-4 w-max ${
          direction === 'forward' ? 'animate-marquee' : 'animate-marquee-reverse'
        }`}
      >
        {items.map(({ name, Logo }, i) => (
          <div
            key={`${name}-${i}`}
            className="flex items-center gap-3 bg-[#111] border border-[#1e1e1e] rounded-2xl px-4 py-2.5 shrink-0 hover:border-[#2a2a2a] hover:bg-[#161616] transition-colors duration-150"
          >
            <Logo />
            <span className="text-[#bbb] text-[13px] font-medium tracking-tight whitespace-nowrap">
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
