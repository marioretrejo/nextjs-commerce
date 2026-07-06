import type { IntegrationType } from "@/lib/supabase/types";

export type FormField = {
  id: string;
  label: string;
  placeholder: string;
  type?: "password" | "url" | "text";
};

export interface IntegrationDef {
  type: IntegrationType;
  name: string;
  description: string;
  logo: string;
  logoSrc?: string;
  docsUrl?: string;
  isWebhook?: boolean;
  comingSoon?: boolean;
  // If set, renders an inline credential form instead of a generic Connect button
  form?: FormField[];
  // Which credential fields map to webhook_url vs credentials JSON
  webhookField?: string;
}

export const INTEGRATIONS: IntegrationDef[] = [
  // ── Notification / Automation ──────────────────────────────────────────────
  {
    type: "telegram",
    name: "Telegram",
    description:
      "Receive call summaries and dispositions as Telegram messages after each call ends.",
    logo: "TG",
    logoSrc: "/telegram-logo.svg",
    form: [
      {
        id: "bot_token",
        label: "Bot Token",
        placeholder: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
        type: "password",
      },
      {
        id: "chat_id",
        label: "Chat ID",
        placeholder: "-1001234567890 or @username",
      },
    ],
  },
  {
    type: "teams",
    name: "Microsoft Teams",
    description:
      "Post call outcome cards to a Teams channel via an Incoming Webhook.",
    logo: "T",
    form: [
      {
        id: "webhook_url",
        label: "Incoming Webhook URL",
        placeholder: "https://org.webhook.office.com/...",
        type: "url",
      },
    ],
    webhookField: "webhook_url",
  },
  {
    type: "n8n",
    name: "n8n",
    description:
      "Send the full call payload (transcript, summary, disposition, extracted data) to your n8n workflow.",
    logo: "n8",
    form: [
      {
        id: "webhook_url",
        label: "Webhook URL",
        placeholder: "https://your-n8n.cloud/webhook/...",
        type: "url",
      },
    ],
    webhookField: "webhook_url",
  },
  // ── Calendar ──────────────────────────────────────────────────────────────
  {
    type: "google_calendar",
    name: "Google Calendar",
    description:
      'Auto-create calendar events when a call ends with disposition "Meeting Booked".',
    logo: "📅",
    comingSoon: false,
    form: [
      {
        id: "client_id",
        label: "OAuth Client ID",
        placeholder: "xxxx.apps.googleusercontent.com",
      },
      {
        id: "client_secret",
        label: "OAuth Client Secret",
        placeholder: "GOCSPX-...",
        type: "password",
      },
      {
        id: "refresh_token",
        label: "Refresh Token",
        placeholder: "Obtain via Google OAuth Playground",
        type: "password",
      },
    ],
  },
  // ── CRM ───────────────────────────────────────────────────────────────────
  {
    type: "hubspot",
    name: "HubSpot",
    description: "Sync contacts and deals from HubSpot CRM.",
    logo: "HS",
  },
  {
    type: "gohighlevel",
    name: "GoHighLevel",
    description: "Integrate with GoHighLevel for CRM and automation.",
    logo: "GHL",
    comingSoon: true,
  },
  {
    type: "salesforce",
    name: "Salesforce",
    description: "Push call outcomes to Salesforce CRM records.",
    logo: "SF",
    comingSoon: true,
  },
  // ── Automation platforms ───────────────────────────────────────────────────
  {
    type: "zapier",
    name: "Zapier",
    description: "Automate workflows with 5,000+ apps via Zapier.",
    logo: "ZAP",
    comingSoon: true,
  },
  {
    type: "make",
    name: "Make",
    description: "Build advanced automations with Make (Integromat).",
    logo: "MK",
    comingSoon: true,
  },
  {
    type: "calendly",
    name: "Calendly",
    description: "Book meetings during calls using Calendly.",
    logo: "CAL",
    comingSoon: true,
  },
  // ── Custom webhook ─────────────────────────────────────────────────────────
  {
    type: "webhook",
    name: "Custom Webhook",
    description:
      "Send real-time event notifications to your endpoint. Manage multiple endpoints →",
    logo: "WH",
    isWebhook: true,
  },
];

export const WEBHOOK_EVENTS = [
  { id: "call.completed", label: "Call Completed" },
  { id: "call.converted", label: "Call Converted" },
  { id: "call.failed", label: "Call Failed" },
  { id: "campaign.started", label: "Campaign Started" },
  { id: "campaign.completed", label: "Campaign Completed" },
  { id: "contact.created", label: "Contact Created" },
];

export const CREDENTIAL_TYPES = new Set([
  "telegram",
  "teams",
  "n8n",
  "google_calendar",
]);
