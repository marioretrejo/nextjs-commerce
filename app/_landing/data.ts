export const SOCIAL_PROOF_LOGOS = [
  "TechCorp",
  "GrowthCo",
  "SalesForce Inc.",
  "LeadGen Pro",
  "RevOps HQ",
  "DialMax",
  "OutreachPro",
];

export const FAQ = [
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

export const FEATURES = [
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

export const STATS = [
  { value: "70+", label: "Languages" },
  { value: "10M+", label: "Calls processed" },
  { value: "< 500ms", label: "Avg. latency" },
  { value: "99.9%", label: "Uptime SLA" },
];

export const HOW_IT_WORKS = [
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

export const TESTIMONIALS = [
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

export const PLANS = [
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
];

export const SERIF = { fontFamily: 'Georgia, "Times New Roman", serif' };
