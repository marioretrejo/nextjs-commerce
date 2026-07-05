"use client";

import { Activity, Code2, Globe, Zap } from "lucide-react";
import { DocSection, CodeBlock, StepBadge } from "./docs-primitives";

export function DocsSectionsA() {
  return (
    <>
      {/* ── Quick Start ─────────────────────────────────────────────── */}
      <DocSection
        title="Quick Start — 3 steps"
        icon={<Zap className="h-4 w-4 text-[#111]" />}
      >
        <ol className="space-y-4 mt-2">
          {[
            {
              n: 1,
              title: "Copy your Webhook URL",
              body: "Go to QA Center → Integrations tab. Copy the unique webhook URL shown there. It looks like:",
              code: "POST https://your-app.vercel.app/api/qac/webhooks/{TOKEN}",
              lang: "bash",
            },
            {
              n: 2,
              title: "Configure your SIP trunk provider",
              body: 'Paste the URL as the "call completed" or "recording ready" callback in your provider settings. See the Provider Guides section below for exact steps per platform.',
            },
            {
              n: 3,
              title: "Enable Auto-Analyze",
              body: "In the Integrations tab, turn on Auto-analyze recordings. Every incoming call will be transcribed (if needed) and scored automatically within seconds of the call ending.",
            },
          ].map(({ n, title, body, code, lang }) => (
            <li key={n} className="flex gap-3">
              <StepBadge n={n} />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-semibold text-[#111]">{title}</p>
                <p className="text-xs text-[#6b6b6b]">{body}</p>
                {code && <CodeBlock code={code} lang={lang} />}
              </div>
            </li>
          ))}
        </ol>
      </DocSection>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <DocSection
        title="Architecture — How it works"
        icon={<Activity className="h-4 w-4 text-[#111]" />}
      >
        <CodeBlock
          lang="flow"
          code={`SIP Trunk / VoIP Provider
        │
        │  POST /api/qac/webhooks/{TOKEN}
        │  Body: JSON or form-encoded with call data
        │
        ▼
┌─────────────────────────────────────────────┐
│         VoiceOS Webhook Receiver            │
│                                             │
│  1. Authenticate via TOKEN in URL           │
│  2. Flatten nested payload                  │
│  3. Extract fields via mapping engine:      │
│     recording_url, agent_name, transcript…  │
│  4. INSERT into qac_interactions            │
│                                             │
│  If transcript missing AND recording_url    │
│  present:                                   │
│    → Download audio from provider           │
│    → Transcribe with Groq Whisper           │
│    → Save transcript to DB                  │
│                                             │
│  If auto_analyze = true:                    │
│    → POST /api/qac/interactions/{id}/analyze│
│    → AI scores 5 criteria (0–100)           │
│    → Detects compliance flags               │
│    → Generates coaching notes              │
└─────────────────────────────────────────────┘
        │
        ▼
   QA Center Dashboard
   Interactions list, scores, flags, reports`}
        />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            {
              label: "Authentication",
              desc: "Token in URL — no extra headers needed",
            },
            {
              label: "Transcription",
              desc: "Groq Whisper (auto) — requires GROQ_API_KEY env var",
            },
            {
              label: "Analysis",
              desc: "Claude AI against your active QA Rules — instant scoring",
            },
          ].map(({ label, desc }) => (
            <div
              key={label}
              className="rounded-xl bg-[#fafafa] border border-[#f0f0f0] p-3"
            >
              <p className="text-xs font-semibold text-[#111] mb-1">{label}</p>
              <p className="text-[11px] text-[#6b6b6b]">{desc}</p>
            </div>
          ))}
        </div>
      </DocSection>

      {/* ── Endpoint reference ────────────────────────────────────────── */}
      <DocSection
        title="Endpoint Reference"
        icon={<Code2 className="h-4 w-4 text-[#111]" />}
      >
        <div className="space-y-4 mt-1">
          <div className="rounded-xl border border-[#e0e0e0] overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-[#fafafa] border-b border-[#e0e0e0]">
              <span className="rounded bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5">
                POST
              </span>
              <code className="text-xs font-mono text-[#111]">
                /api/qac/webhooks/
                <span className="text-blue-600">{"{TOKEN}"}</span>
              </code>
            </div>
            <div className="px-4 py-3 space-y-3 text-xs text-[#555]">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <span className="font-semibold text-[#333]">Auth</span>
                  <br />
                  TOKEN in URL path (from Integrations tab)
                </div>
                <div>
                  <span className="font-semibold text-[#333]">
                    Content-Type
                  </span>
                  <br />
                  <code className="bg-[#f0f0f0] px-1 rounded">
                    application/json
                  </code>{" "}
                  or{" "}
                  <code className="bg-[#f0f0f0] px-1 rounded">
                    application/x-www-form-urlencoded
                  </code>
                </div>
                <div>
                  <span className="font-semibold text-[#333]">
                    Response (success)
                  </span>
                  <br />
                  <code className="bg-[#f0f0f0] px-1 rounded">
                    202 Accepted
                  </code>{" "}
                  — analysis runs async
                </div>
                <div>
                  <span className="font-semibold text-[#333]">
                    Response (error)
                  </span>
                  <br />
                  <code className="bg-[#f0f0f0] px-1 rounded">404</code> invalid
                  token · <code className="bg-[#f0f0f0] px-1 rounded">400</code>{" "}
                  bad body
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs font-semibold text-[#333]">
            Minimum required fields
          </p>
          <p className="text-xs text-[#6b6b6b]">
            You must send at least one of:{" "}
            <code className="bg-[#f0f0f0] px-1 rounded">transcript</code> (text)
            or <code className="bg-[#f0f0f0] px-1 rounded">recording_url</code>{" "}
            (audio URL). Everything else is optional but improves data quality.
          </p>

          <CodeBlock
            lang="json — minimal payload"
            code={`{
  "recording_url": "https://api.twilio.com/recordings/RE123.mp3",
  "agent_name": "Maria Garcia",
  "call_id": "CA0000xxxx"
}`}
          />

          <CodeBlock
            lang="json — full payload"
            code={`{
  "recording_url": "https://cdn.provider.com/recordings/abc123.mp3",
  "transcript":    "Agent: Thank you for calling...",
  "agent_name":    "Maria Garcia",
  "agent_id":      "EMP-0042",
  "customer_phone": "+15551234567",
  "customer_name":  "John Smith",
  "call_id":        "call_uuid_abc123",
  "duration":       "245",
  "direction":      "inbound",
  "outcome":        "resolved",
  "language":       "en"
}`}
          />
        </div>
      </DocSection>

      {/* ── Provider guides ───────────────────────────────────────────── */}
      <DocSection
        title="Provider Setup Guides"
        icon={<Globe className="h-4 w-4 text-[#111]" />}
      >
        <div className="space-y-6 mt-1">
          {/* Twilio */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#f22f46] text-white text-[10px] font-bold px-2 py-0.5">
                Twilio
              </span>
              <span className="text-xs text-[#9b9b9b]">
                Default mappings work out of the box
              </span>
            </div>
            <ol className="space-y-1.5 text-xs text-[#555] list-decimal pl-4">
              <li>
                Twilio Console → <strong>Phone Numbers</strong> →{" "}
                <strong>Manage</strong> → <strong>Active Numbers</strong>
              </li>
              <li>
                Click your number → scroll to{" "}
                <strong>Voice Configuration</strong>
              </li>
              <li>
                Under <strong>Call Status Changes</strong> paste your webhook
                URL
              </li>
              <li>
                Enable <strong>Record calls</strong> → set{" "}
                <strong>Recording Status Callback</strong> to the same URL
              </li>
            </ol>
            <CodeBlock
              lang="twilio payload (sent automatically)"
              code={`{
  "CallSid":           "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "RecordingUrl":      "https://api.twilio.com/2010-04-01/Accounts/.../Recordings/RExx",
  "RecordingDuration": "120",
  "From":              "+15551234567",
  "To":                "+15559876543",
  "CallStatus":        "completed"
}`}
            />
          </div>

          {/* Squaretalk */}
          <div className="space-y-3 border-t border-[#f0f0f0] pt-5">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#5b45d5] text-white text-[10px] font-bold px-2 py-0.5">
                Squaretalk
              </span>
              <span className="text-xs text-[#9b9b9b]">
                Use the Squaretalk preset in Integrations tab
              </span>
            </div>
            <ol className="space-y-1.5 text-xs text-[#555] list-decimal pl-4">
              <li>
                Squaretalk Admin → <strong>Settings</strong> →{" "}
                <strong>Webhooks</strong>
              </li>
              <li>
                Add webhook → Event: <strong>call.completed</strong>
              </li>
              <li>Paste your webhook URL → Save</li>
              <li>
                In VoiceOS Integrations tab, click{" "}
                <strong>Load Squaretalk preset</strong>
              </li>
            </ol>
            <CodeBlock
              lang="squaretalk payload example"
              code={`{
  "call_id":       "abc-123-xyz",
  "agent_name":    "maria.garcia",
  "caller_id":     "+15551234567",
  "recording_url": "https://cdn.squaretalk.com/recordings/abc123.mp3",
  "duration":      245,
  "direction":     "inbound",
  "disposition":   "answered"
}`}
            />
          </div>

          {/* Voiso */}
          <div className="space-y-3 border-t border-[#f0f0f0] pt-5">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#00b4d8] text-white text-[10px] font-bold px-2 py-0.5">
                Voiso
              </span>
              <span className="text-xs text-[#9b9b9b]">
                Use the Voiso preset in Integrations tab
              </span>
            </div>
            <ol className="space-y-1.5 text-xs text-[#555] list-decimal pl-4">
              <li>
                Voiso Dashboard → <strong>Settings</strong> →{" "}
                <strong>Integrations</strong> → <strong>Webhooks</strong>
              </li>
              <li>
                Create webhook → Event: <strong>Call Completed</strong>
              </li>
              <li>Paste your webhook URL → Save</li>
              <li>
                In VoiceOS Integrations tab, click{" "}
                <strong>Load Voiso preset</strong>
              </li>
            </ol>
            <CodeBlock
              lang="voiso payload example"
              code={`{
  "call_id":       "voiso_call_9876",
  "agent":         "agent@company.com",
  "customer_phone": "+15551234567",
  "audioUrl":      "https://recordings.voiso.com/9876.mp3",
  "billsec":       180,
  "direction":     "inbound",
  "disposition":   "ANSWERED"
}`}
            />
          </div>

          {/* Custom / Generic */}
          <div className="space-y-3 border-t border-[#f0f0f0] pt-5">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#555] text-white text-[10px] font-bold px-2 py-0.5">
                Custom SIP / Generic
              </span>
            </div>
            <p className="text-xs text-[#555]">
              Send a <code className="bg-[#f0f0f0] px-1 rounded">POST</code>{" "}
              with any field names and use the{" "}
              <strong>Field Mapping Engine</strong> in the Integrations tab to
              tell VoiceOS which key maps to which concept. Supports nested JSON
              (dot-notation) and form-encoded bodies.
            </p>
            <CodeBlock
              lang="curl example"
              code={`curl -X POST "https://your-app.vercel.app/api/qac/webhooks/YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "my_recording": "https://cdn.myapp.com/call_123.mp3",
    "operator":     "Maria Garcia",
    "src_number":   "+15551234567",
    "uniqueid":     "call_123",
    "billsec":      "245"
  }'`}
            />
            <p className="text-xs text-[#6b6b6b]">
              Then in the Field Mapping Engine, set{" "}
              <code className="bg-[#f0f0f0] px-1 rounded">recording_url</code>{" "}
              candidates to{" "}
              <code className="bg-[#f0f0f0] px-1 rounded">my_recording</code>{" "}
              and <code className="bg-[#f0f0f0] px-1 rounded">agent_name</code>{" "}
              to <code className="bg-[#f0f0f0] px-1 rounded">operator</code>.
            </p>
          </div>
        </div>
      </DocSection>
    </>
  );
}
