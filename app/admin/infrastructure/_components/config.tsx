import { Activity, Cpu, DollarSign, Phone } from "lucide-react";
import type { Tab } from "./types";

export const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "voice", label: "Voice Engines", icon: <Cpu className="w-4 h-4" /> },
  { id: "telephony", label: "Telephony", icon: <Phone className="w-4 h-4" /> },
  {
    id: "costs",
    label: "Cost Dashboard",
    icon: <DollarSign className="w-4 h-4" />,
  },
  {
    id: "health",
    label: "Provider Health",
    icon: <Activity className="w-4 h-4" />,
  },
];

export const VOICE_ENGINES = [
  {
    tier: "Standard Voice",
    internal: "ElevenLabs v2",
    altInternal: "Cartesia Sonic-3",
    defaultEngine: "elevenlabs_v2",
    costPerMin: 0.03,
    monthlyMinutes: 12480,
    envKey: "ELEVENLABS_API_KEY",
    status: "active",
  },
  {
    tier: "Ultra-Fast Voice",
    internal: "Cartesia Sonic-3",
    altInternal: "Deepgram",
    defaultEngine: "cartesia_sonic3",
    costPerMin: 0.025,
    monthlyMinutes: 3120,
    envKey: "CARTESIA_API_KEY",
    status: "active",
  },
  {
    tier: "Premium Voice",
    internal: "ElevenLabs v3",
    altInternal: null,
    defaultEngine: "elevenlabs_v3",
    costPerMin: 0.06,
    monthlyMinutes: 780,
    envKey: "ELEVENLABS_API_KEY",
    status: "locked",
  },
];

export const TELEPHONY_PROVIDERS = [
  { name: "Twilio", type: "twilio", status: "active", cost: "$0.0085/min" },
  { name: "Telnyx", type: "telnyx", status: "active", cost: "$0.0045/min" },
  {
    name: "Vonage",
    type: "vonage",
    status: "disconnected",
    cost: "$0.0090/min",
  },
  {
    name: "VoIP.ms",
    type: "voip_ms",
    status: "disconnected",
    cost: "$0.0069/min",
  },
  {
    name: "Custom SIP",
    type: "custom_sip",
    status: "disconnected",
    cost: "Custom",
  },
];

export const MOCK_WORKSPACE_COSTS = [
  {
    name: "Acme Corp",
    plan: "scale",
    minutesUsed: 4800,
    planRevenue: 297,
    providerCost: 144,
  },
  {
    name: "Beta Labs",
    plan: "pro",
    minutesUsed: 980,
    planRevenue: 97,
    providerCost: 29.4,
  },
  {
    name: "Gamma Inc",
    plan: "scale",
    minutesUsed: 5200,
    planRevenue: 297,
    providerCost: 156,
  },
  {
    name: "Delta LLC",
    plan: "free",
    minutesUsed: 48,
    planRevenue: 0,
    providerCost: 1.44,
  },
  {
    name: "Epsilon Co",
    plan: "pro",
    minutesUsed: 1100,
    planRevenue: 97,
    providerCost: 33,
  },
];

// ── Provider Health types ──────────────────────────────────────────────────────
