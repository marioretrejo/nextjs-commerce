import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WaveformPlayer } from "@/components/calls/WaveformPlayer";
import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/utils";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import type { CallDisposition } from "@/lib/supabase/types";

interface CallDetail {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  direction: string;
  duration_seconds: number;
  status: string | null;
  outcome: string | null;
  sentiment: string | null;
  disposition: CallDisposition | null;
  transcript: string | null;
  recording_url: string | null;
  summary: string | null;
  task_completed: boolean;
  extracted_name: string | null;
  extracted_email: string | null;
  extracted_interest: string | null;
  extracted_objections: string | null;
  qa_score: number | null;
  qa_feedback: string | null;
  cost_usd: number;
  created_at: string;
  // External-import metadata (migration 075)
  external_source: string | null;
  external_agent_name: string | null;
  department: string | null;
  prospect_id: string | null;
  crm_id: string | null;
  extension: string | null;
  analysis_status: string | null;
  analysis_error: string | null;
  recording_storage_path: string | null;
  agent: { name: string } | null;
  campaign: { name: string } | null;
}

const ANALYSIS_STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  pending: {
    label: "Analysis pending",
    className: "bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]",
  },
  processing: {
    label: "Analyzing…",
    className: "bg-[#f5f5f5] text-[#0a0a0a] border-[#e0e0e0]",
  },
  error: {
    label: "Analysis failed",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-emerald-50 text-emerald-700",
  neutral: "bg-[#f5f5f5] text-[#6b6b6b]",
  negative: "bg-red-50 text-red-700",
};

const DISPOSITION_CONFIG: Record<
  CallDisposition,
  { label: string; className: string }
> = {
  meeting_booked: {
    label: "Meeting Booked",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  completed: {
    label: "Completed",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  follow_up: {
    label: "Follow Up",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  callback_requested: {
    label: "Callback Requested",
    className: "bg-violet-50 text-violet-700 border-violet-200",
  },
  not_interested: {
    label: "Not Interested",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  voicemail: {
    label: "Voicemail",
    className: "bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]",
  },
  transferred: {
    label: "Transferred",
    className: "bg-[#f5f5f5] text-[#0a0a0a] border-[#e0e0e0]",
  },
  other: {
    label: "Other",
    className: "bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]",
  },
};

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("calls")
    .select("*, agent:agents(name), campaign:campaigns(name)")
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  const call = data as unknown as CallDetail;

  // The recording is served through /api/calls/[id]/recording, which mints a
  // fresh signed URL (native + imported calls) — the raw recording_url is an S3
  // path or an external URL not directly playable by the browser.
  const hasRecording = !!(call.recording_storage_path || call.recording_url);
  const recordingUrl = hasRecording ? `/api/calls/${call.id}/recording` : null;

  return (
    <div className="p-6 mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/calls">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">
            {call.contact_name ?? call.contact_phone ?? "Unknown Contact"}
          </h1>
          <p className="text-sm text-[#6b6b6b]">
            {new Date(call.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {call.disposition && DISPOSITION_CONFIG[call.disposition] && (
            <Badge
              className={`${DISPOSITION_CONFIG[call.disposition].className} text-xs`}
            >
              {DISPOSITION_CONFIG[call.disposition].label}
            </Badge>
          )}
          {call.sentiment && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SENTIMENT_COLORS[call.sentiment] ?? "bg-gray-100 text-gray-700"}`}
            >
              {call.sentiment}
            </span>
          )}
          {call.qa_score !== null && (
            <Badge variant={call.qa_score >= 70 ? "default" : "secondary"}>
              QA {call.qa_score.toFixed(0)}
            </Badge>
          )}
          {(() => {
            const cfg = call.analysis_status
              ? ANALYSIS_STATUS_CONFIG[call.analysis_status]
              : undefined;
            return cfg ? (
              <Badge className={`${cfg.className} text-xs`}>{cfg.label}</Badge>
            ) : null;
          })()}
        </div>
      </div>

      {call.external_source && (
        <Card>
          <CardHeader>
            <CardTitle>Imported call</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-[#e0e0e0]">
            {[
              { label: "Provider", value: call.external_source },
              { label: "Department", value: call.department },
              { label: "External agent", value: call.external_agent_name },
              { label: "Prospect ID", value: call.prospect_id },
              { label: "CRM ID", value: call.crm_id },
              { label: "Extension", value: call.extension },
              {
                label: "Analysis status",
                value: call.analysis_error
                  ? `${call.analysis_status ?? "—"} — ${call.analysis_error}`
                  : (call.analysis_status ?? "—"),
              },
            ]
              .filter((r) => r.value)
              .map(({ label, value }) => (
                <div
                  key={label}
                  className="flex justify-between py-2.5 text-sm"
                >
                  <span className="text-[#6b6b6b]">{label}</span>
                  <span className="font-medium max-w-[60%] text-right capitalize">
                    {value}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Duration", value: formatDuration(call.duration_seconds) },
          { label: "Agent", value: call.agent?.name ?? "—" },
          { label: "Campaign", value: call.campaign?.name ?? "—" },
          { label: "Cost", value: `$${call.cost_usd.toFixed(3)}` },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-[#6b6b6b]">{label}</p>
              <p className="font-semibold text-sm truncate">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Waveform player + synced transcript */}
      {recordingUrl ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recording &amp; Transcript</CardTitle>
              <a
                href={`${recordingUrl}?download=1`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download MP3
              </a>
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-0">
            <div className="px-5 pb-5">
              <WaveformPlayer
                url={recordingUrl}
                transcript={call.transcript}
                duration={call.duration_seconds}
              />
            </div>
          </CardContent>
        </Card>
      ) : call.transcript ? (
        <Card>
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2">
              {call.transcript
                .split("\n")
                .filter(Boolean)
                .map((line, i) => {
                  // A line is from the agent if it has ANY word prefix followed by ":"
                  // UNLESS that prefix is a known user keyword (user/caller/contact/cliente).
                  const isAgent =
                    /^\S+\s*:/.test(line) &&
                    !/^(user|caller|contact|cliente)\s*:/i.test(line);
                  const text = line.replace(/^\S+\s*:\s*/, "").trim();
                  return (
                    <div
                      key={i}
                      className={`flex gap-3 ${isAgent ? "flex-row" : "flex-row-reverse"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm ${isAgent ? "bg-[#0a0a0a] text-white" : "bg-[#f5f5f5] text-[#0a0a0a]"}`}
                      >
                        <p
                          className={`mb-1 text-xs font-medium ${isAgent ? "text-[#aaa]" : "text-[#6b6b6b]"}`}
                        >
                          {isAgent ? "Agent" : "Contact"}
                        </p>
                        {text}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {call.summary && (
        <Card>
          <CardHeader>
            <CardTitle>AI Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#6b6b6b] whitespace-pre-line">
              {call.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {call.qa_score !== null && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Quality Score</CardTitle>
              <span
                className={`text-2xl font-bold ${call.qa_score >= 80 ? "text-emerald-600" : call.qa_score >= 50 ? "text-amber-600" : "text-red-600"}`}
              >
                {call.qa_score}
                <span className="text-sm font-normal text-[#6b6b6b]">/100</span>
              </span>
            </div>
          </CardHeader>
          {call.qa_feedback && (
            <CardContent>
              <div
                className={`rounded-lg px-4 py-3 text-sm ${call.qa_score >= 80 ? "bg-emerald-50 text-emerald-800" : call.qa_score >= 50 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-800"}`}
              >
                {call.qa_feedback}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {(call.extracted_name ||
        call.extracted_email ||
        call.extracted_interest ||
        call.extracted_objections) && (
        <Card>
          <CardHeader>
            <CardTitle>Extracted Data</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-[#e0e0e0]">
            {[
              { label: "Name", value: call.extracted_name },
              { label: "Email", value: call.extracted_email },
              { label: "Interest", value: call.extracted_interest },
              { label: "Objections", value: call.extracted_objections },
              {
                label: "Task Completed",
                value: call.task_completed ? "Yes" : "No",
              },
            ]
              .filter((r) => r.value)
              .map(({ label, value }) => (
                <div
                  key={label}
                  className="flex justify-between py-2.5 text-sm"
                >
                  <span className="text-[#6b6b6b]">{label}</span>
                  <span className="font-medium max-w-[60%] text-right">
                    {value}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
