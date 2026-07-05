"use client";

import { Code2, Settings2, ShieldAlert } from "lucide-react";
import { DocSection, CodeBlock } from "./docs-primitives";

export function DocsSectionsB() {
  return (
    <>
      {/* ── Field reference ───────────────────────────────────────────── */}
      <DocSection
        title="Field Mapping Reference"
        icon={<Settings2 className="h-4 w-4 text-[#111]" />}
      >
        <p className="text-xs text-[#6b6b6b] mb-3 mt-1">
          These are the VoiceOS internal fields. For each one you can configure
          which keys from your provider's payload to look at (ordered — first
          non-empty match wins).
        </p>
        <div className="rounded-xl border border-[#e0e0e0] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#fafafa] border-b border-[#e0e0e0]">
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">
                  Field
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">
                  Required
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0] text-xs">
              {[
                {
                  field: "recording_url",
                  type: "string (URL)",
                  req: true,
                  desc: "Audio file URL. If transcript is missing, this is downloaded and transcribed via Groq Whisper.",
                },
                {
                  field: "transcript",
                  type: "string",
                  req: true,
                  desc: "Plain text transcript of the call. If provided, skips audio transcription.",
                },
                {
                  field: "agent_name",
                  type: "string",
                  req: false,
                  desc: "Human-readable agent name shown in the QA Center.",
                },
                {
                  field: "agent_id",
                  type: "string",
                  req: false,
                  desc: "Internal agent ID (e.g. employee number, extension).",
                },
                {
                  field: "customer_phone",
                  type: "string",
                  req: false,
                  desc: "Customer's phone number in E.164 or local format.",
                },
                {
                  field: "customer_name",
                  type: "string",
                  req: false,
                  desc: "Customer name if available (CRM lookup, etc.).",
                },
                {
                  field: "call_id",
                  type: "string",
                  req: false,
                  desc: "Your platform call UUID — used for deduplication.",
                },
                {
                  field: "duration",
                  type: "number (s)",
                  req: false,
                  desc: "Call duration in seconds.",
                },
                {
                  field: "direction",
                  type: "inbound|outbound",
                  req: false,
                  desc: "Call direction.",
                },
                {
                  field: "outcome",
                  type: "string",
                  req: false,
                  desc: "Call disposition (answered, resolved, transferred…).",
                },
                {
                  field: "language",
                  type: "ISO 639-1",
                  req: false,
                  desc: "Language hint for Whisper transcription (e.g. en, es, fr). Defaults to en.",
                },
              ].map(({ field, type, req, desc }) => (
                <tr key={field} className="hover:bg-[#fafafa]">
                  <td className="px-4 py-2.5">
                    <code className="font-mono text-[11px] text-[#111]">
                      {field}
                    </code>
                  </td>
                  <td className="px-4 py-2.5 text-[#6b6b6b] font-mono text-[10px]">
                    {type}
                  </td>
                  <td className="px-4 py-2.5">
                    {req ? (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        one of *
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#c0c0c0]">
                        optional
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[#555]">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2.5 bg-[#fafafa] border-t border-[#e0e0e0]">
            <p className="text-[10px] text-[#9b9b9b]">
              * At least one of{" "}
              <code className="bg-[#f0f0f0] px-1 rounded">recording_url</code>{" "}
              or <code className="bg-[#f0f0f0] px-1 rounded">transcript</code>{" "}
              must be present. All other fields are optional.
            </p>
          </div>
        </div>
      </DocSection>

      {/* ── Manual REST API ───────────────────────────────────────────── */}
      <DocSection
        title="Manual REST API (direct integration)"
        icon={<Code2 className="h-4 w-4 text-[#111]" />}
      >
        <p className="text-xs text-[#6b6b6b] mt-1 mb-3">
          If you prefer to create interactions programmatically (e.g. from your
          own backend), use the interactions API directly with your workspace
          API key.
        </p>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#333]">
            1. Create an interaction
          </p>
          <CodeBlock
            lang="curl"
            code={`curl -X POST "https://your-app.vercel.app/api/qac/interactions" \\
  -H "Authorization: Bearer vos_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_name": "Maria Garcia",
    "agent_id":   "EMP-0042",
    "channel":    "call",
    "transcript": "Agent: Thank you for calling...",
    "duration_s": 245
  }'`}
          />
          <p className="text-[10px] text-[#9b9b9b]">
            Returns the interaction object with its{" "}
            <code className="bg-[#f0f0f0] px-1 rounded">id</code>.
          </p>

          <p className="text-xs font-semibold text-[#333] pt-2">
            2. Trigger analysis
          </p>
          <CodeBlock
            lang="curl"
            code={`curl -X POST "https://your-app.vercel.app/api/qac/interactions/{INTERACTION_ID}/analyze" \\
  -H "Authorization: Bearer vos_YOUR_API_KEY"`}
          />
          <p className="text-[10px] text-[#9b9b9b]">
            Returns the evaluation with{" "}
            <code className="bg-[#f0f0f0] px-1 rounded">overall_score</code>,{" "}
            <code className="bg-[#f0f0f0] px-1 rounded">criteria_scores</code>,
            flags, and coaching notes.
          </p>

          <p className="text-xs font-semibold text-[#333] pt-2">
            3. Retrieve results
          </p>
          <CodeBlock
            lang="curl"
            code={`curl "https://your-app.vercel.app/api/qac/interactions/{INTERACTION_ID}" \\
  -H "Authorization: Bearer vos_YOUR_API_KEY"`}
          />
        </div>
      </DocSection>

      {/* ── Env vars ─────────────────────────────────────────────────── */}
      <DocSection
        title="Required Environment Variables"
        icon={<ShieldAlert className="h-4 w-4 text-[#111]" />}
      >
        <div className="mt-1 rounded-xl border border-[#e0e0e0] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#fafafa] border-b border-[#e0e0e0]">
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">
                  Variable
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">
                  Required for
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {[
                {
                  key: "GROQ_API_KEY",
                  for: "Audio transcription",
                  note: "Free tier at console.groq.com — needed to auto-transcribe recordings",
                },
                {
                  key: "GROQ_API_KEY",
                  for: "QA scoring / analysis",
                  note: "Required for AI scoring. Free tier at console.groq.com",
                },
                {
                  key: "INTERNAL_API_SECRET",
                  for: "Auto-analyze security",
                  note: "Any random 32-char hex. Prevents unauthorized calls to the analyze endpoint.",
                },
                {
                  key: "NEXT_PUBLIC_APP_URL",
                  for: "Correct redirect URLs",
                  note: "Your deployed app URL (e.g. https://your-app.vercel.app)",
                },
              ].map(({ key, for: forStr, note }) => (
                <tr key={key} className="hover:bg-[#fafafa]">
                  <td className="px-4 py-2.5">
                    <code className="font-mono text-[11px] text-[#111]">
                      {key}
                    </code>
                  </td>
                  <td className="px-4 py-2.5 text-[#555]">{forStr}</td>
                  <td className="px-4 py-2.5 text-[#9b9b9b]">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocSection>
    </>
  );
}
