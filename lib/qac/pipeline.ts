import { transcribeAudioDetailed } from "@/lib/deepgram";
import { groqJson } from "@/lib/groq";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadQacStoredAudio } from "./audio-storage";
import { isSafeUrl } from "./ssrf";
import { calculateQacScore } from "./scoring";
import type { QacCriterion, QacCriterionResultInput } from "./types";

type Admin = ReturnType<typeof createAdminClient>;

interface InteractionForPipeline {
  id: string;
  workspace_id: string;
  provider_id: string | null;
  external_call_id: string | null;
  department_id: string | null;
  recording_url: string | null;
  internal_audio_url: string | null;
  direction: string | null;
  status: string;
}

interface AnalysisJson {
  summary?: string;
  sentiment?: string;
  risk_level?: string;
  call_disposition?: string;
  strengths?: unknown[];
  opportunities?: unknown[];
  recommendations?: unknown[];
  detected_objections?: unknown[];
  follow_up_detected?: boolean;
  tracker_results?: Array<{
    tracker_id?: string;
    name?: string;
    detected?: boolean;
    confidence?: number;
    reason?: string;
    evidence_json?: unknown[];
    evidence?: unknown[];
  }>;
  criteria_results?: Array<
    Partial<QacCriterionResultInput> & {
      name?: string;
      evidence?: unknown[];
    }
  >;
}

interface QacTracker {
  id: string;
  name: string;
  description: string;
  severity: string;
  risk_level_override: string | null;
  trigger_manual_review: boolean;
  positive_examples_json: unknown;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeRisk(value: unknown): string {
  return ["low", "medium", "high", "critical"].includes(String(value))
    ? String(value)
    : "medium";
}

function riskRank(value: string): number {
  return { low: 1, medium: 2, high: 3, critical: 4 }[value] ?? 2;
}

function strongestRisk(a: string, b: string | null): string {
  if (!b) return a;
  return riskRank(b) > riskRank(a) ? b : a;
}

function contentTypeFor(url: string): string {
  if (/\.wav(\?|$)/i.test(url)) return "audio/wav";
  if (/\.(ogg|oga)(\?|$)/i.test(url)) return "audio/ogg";
  if (/\.(m4a|mp4)(\?|$)/i.test(url)) return "audio/mp4";
  return "audio/mpeg";
}

function missingColumn(errorMessage?: string | null): boolean {
  const message = errorMessage ?? "";
  return message.includes("Could not find") || message.includes("schema cache");
}

function missingTable(errorMessage?: string | null): boolean {
  const message = errorMessage ?? "";
  return message.includes("Could not find") || message.includes("schema cache");
}

async function fetchQacTrackers(
  admin: Admin,
  workspaceId: string,
  departmentId: string,
): Promise<QacTracker[]> {
  const { data, error } = await admin
    .from("qac_trackers")
    .select(
      `id, name, description, severity, risk_level_override,
       trigger_manual_review, positive_examples_json`,
    )
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .or(`department_id.is.null,department_id.eq.${departmentId}`);

  if (error) {
    if (missingTable(error.message)) return [];
    console.error("[qac-trackers] fetch failed:", error.message);
    return [];
  }

  return (data as QacTracker[] | null) ?? [];
}

function normalizeTrackerResults(analysis: AnalysisJson): Array<{
  tracker_id: string | null;
  name: string | null;
  detected: boolean;
  confidence: number | null;
  reason: string | null;
  evidence_json: unknown[];
}> {
  return (analysis.tracker_results ?? []).map((result) => ({
    tracker_id: asString(result.tracker_id),
    name: asString(result.name),
    detected: Boolean(result.detected),
    confidence:
      typeof result.confidence === "number" &&
      Number.isFinite(result.confidence)
        ? result.confidence
        : null,
    reason: asString(result.reason),
    evidence_json: Array.isArray(result.evidence_json)
      ? result.evidence_json
      : Array.isArray(result.evidence)
        ? result.evidence
        : [],
  }));
}

function trackerImpact(
  trackers: QacTracker[],
  results: ReturnType<typeof normalizeTrackerResults>,
): { riskLevel: string | null; requiresManualReview: boolean } {
  let riskLevel: string | null = null;
  let requiresManualReview = false;

  for (const result of results) {
    if (!result.detected) continue;
    const tracker = trackers.find(
      (item) =>
        item.id === result.tracker_id ||
        item.name.toLowerCase() === (result.name ?? "").toLowerCase(),
    );
    if (!tracker) continue;
    requiresManualReview ||= tracker.trigger_manual_review;
    const override = normalizeRisk(tracker.risk_level_override);
    if (tracker.risk_level_override) {
      riskLevel = strongestRisk(riskLevel ?? "low", override);
    }
  }

  return { riskLevel, requiresManualReview };
}

async function fetchAudio(url: string): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  if (!isSafeUrl(url)) return null;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "audio/mpeg,audio/wav,audio/*,*/*",
        Referer: "https://sequoia.squaretalk.com/reporting/calls",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) return null;
    return {
      buffer,
      contentType: res.headers.get("content-type") ?? contentTypeFor(url),
    };
  } catch {
    return null;
  }
}

async function getTranscript(
  admin: Admin,
  interaction: InteractionForPipeline,
): Promise<string | null> {
  const { data: existing } = await admin
    .from("qac_transcripts")
    .select("full_text, diarized_json")
    .eq("interaction_id", interaction.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const saved = asString(
    (existing as { full_text?: unknown } | null)?.full_text,
  );
  const savedSegments = (existing as { diarized_json?: unknown } | null)
    ?.diarized_json;
  if (saved && Array.isArray(savedSegments) && savedSegments.length > 0) {
    return saved;
  }

  const audioUrl = interaction.internal_audio_url ?? interaction.recording_url;
  if (!audioUrl) {
    await admin
      .from("qac_interactions")
      .update({ status: "pending_audio" })
      .eq("id", interaction.id);
    return null;
  }

  await admin
    .from("qac_interactions")
    .update({ status: "transcribing" })
    .eq("id", interaction.id);

  const audio = audioUrl.startsWith("http")
    ? await fetchAudio(audioUrl)
    : await downloadQacStoredAudio(admin, audioUrl);
  if (!audio) {
    await admin
      .from("qac_interactions")
      .update({ status: "failed_audio" })
      .eq("id", interaction.id);
    return null;
  }

  const result = await transcribeAudioDetailed(
    audio.buffer,
    "es",
    audio.contentType,
    interaction.direction,
  );
  const transcript = result.transcript;
  if (!transcript.trim()) {
    await admin
      .from("qac_interactions")
      .update({ status: "failed_transcription" })
      .eq("id", interaction.id);
    return null;
  }

  await admin.from("qac_transcripts").insert({
    workspace_id: interaction.workspace_id,
    interaction_id: interaction.id,
    full_text: transcript,
    diarized_json: result.segments,
    language: "es",
    provider: "deepgram",
  });

  const updateResult = await admin
    .from("qac_interactions")
    .update({ status: "transcribed", transcript })
    .eq("id", interaction.id);
  if (missingColumn(updateResult.error?.message)) {
    await admin
      .from("qac_interactions")
      .update({ status: "transcribed" })
      .eq("id", interaction.id);
  }

  return transcript;
}

function buildAnalysisPrompt(params: {
  departmentName: string;
  departmentPrompt: string | null;
  scorecardName: string;
  criteria: QacCriterion[];
  trackers: QacTracker[];
  transcript: string;
}): string {
  const criteria = params.criteria.map((criterion) => ({
    criterion_id: criterion.id,
    name: criterion.name,
    category: criterion.category,
    weight: criterion.weight,
    critical: criterion.is_critical,
    applicability_rule: criterion.applicability_rule,
    pass_definition: criterion.pass_definition,
    partial_definition: criterion.partial_definition,
    fail_definition: criterion.fail_definition,
    na_definition: criterion.na_definition,
    examples: criterion.examples_json,
  }));
  const trackers = params.trackers.map((tracker) => ({
    tracker_id: tracker.id,
    name: tracker.name,
    description: tracker.description,
    severity: tracker.severity,
    trigger_manual_review: tracker.trigger_manual_review,
    risk_level_override: tracker.risk_level_override,
    examples: tracker.positive_examples_json,
  }));

  return `You are QA Center for real human call center calls imported from a VoIP CDR.
Do not assume this call came from an AI voice agent. Evaluate only the transcript below.

Department: ${params.departmentName}
Scorecard: ${params.scorecardName}
Department-specific QA prompt:
${params.departmentPrompt ?? "Use the scorecard criteria as the source of truth."}

Return strict JSON with:
{
  "summary": string,
  "sentiment": "positive" | "neutral" | "negative",
  "risk_level": "low" | "medium" | "high" | "critical",
  "call_disposition": string,
  "strengths": string[],
  "opportunities": string[],
  "recommendations": string[],
  "detected_objections": string[],
  "follow_up_detected": boolean,
  "tracker_results": [
    {
      "tracker_id": string,
      "name": string,
      "detected": boolean,
      "confidence": number,
      "reason": string,
      "evidence_json": [{"timestamp_seconds": number | null, "quote": string}]
    }
  ],
  "criteria_results": [
    {
      "criterion_id": string,
      "applicable": boolean,
      "result": "pass" | "partial" | "fail" | "n/a",
      "score": number,
      "reason": string,
      "evidence_json": [{"timestamp_seconds": number | null, "quote": string}]
    }
  ]
}

Scoring rules:
- If a criterion is not applicable, return applicable=false, result="n/a", score=null.
- Do not award or subtract points for N/A criteria.
- If evidence is unavailable, explain the reason without inventing quotes.
- Trackers do not affect score directly. Detect each tracker independently.

Criteria:
${JSON.stringify(criteria, null, 2)}

Trackers:
${JSON.stringify(trackers, null, 2)}

Transcript:
${params.transcript}`;
}

function buildPromptOnlyAnalysisPrompt(params: {
  departmentName: string;
  departmentPrompt: string | null;
  trackers: QacTracker[];
  transcript: string;
}): string {
  const trackers = params.trackers.map((tracker) => ({
    tracker_id: tracker.id,
    name: tracker.name,
    description: tracker.description,
    severity: tracker.severity,
    trigger_manual_review: tracker.trigger_manual_review,
    risk_level_override: tracker.risk_level_override,
    examples: tracker.positive_examples_json,
  }));

  return `You are QA Center for real human call center calls imported from a VoIP CDR.
Do not assume this call came from an AI voice agent. Evaluate only the transcript below.

Department: ${params.departmentName}
Department-specific QA prompt:
${params.departmentPrompt ?? "Analyze call quality, customer intent, risks, and improvement opportunities."}

Return strict JSON with:
{
  "summary": string,
  "sentiment": "positive" | "neutral" | "negative",
  "risk_level": "low" | "medium" | "high" | "critical",
  "call_disposition": string,
  "strengths": string[],
  "opportunities": string[],
  "recommendations": string[],
  "detected_objections": string[],
  "follow_up_detected": boolean,
  "tracker_results": [
    {
      "tracker_id": string,
      "name": string,
      "detected": boolean,
      "confidence": number,
      "reason": string,
      "evidence_json": [{"timestamp_seconds": number | null, "quote": string}]
    }
  ]
}

If evidence is unavailable, say so without inventing facts.
Trackers do not affect score directly. Detect each tracker independently.

Trackers:
${JSON.stringify(trackers, null, 2)}

Transcript:
${params.transcript}`;
}

export async function processQacInteraction(interactionId: string): Promise<{
  ok: boolean;
  status: string;
  analysisId?: string;
  error?: string;
}> {
  const admin = createAdminClient();

  const { data: rawInteraction } = await admin
    .from("qac_interactions")
    .select(
      "id, workspace_id, provider_id, external_call_id, department_id, recording_url, internal_audio_url, direction, status",
    )
    .eq("id", interactionId)
    .maybeSingle();

  const interaction = rawInteraction as InteractionForPipeline | null;
  if (!interaction) {
    return { ok: false, status: "missing", error: "Interaction not found" };
  }

  if (!interaction.department_id) {
    await admin
      .from("qac_interactions")
      .update({ status: "manual_review_required" })
      .eq("id", interaction.id);
    return {
      ok: false,
      status: "manual_review_required",
      error: "No QA Center department matched this CDR",
    };
  }

  const transcript = await getTranscript(admin, interaction);
  if (!transcript) {
    return { ok: false, status: "failed_transcription" };
  }

  const { data: deptRaw } = await admin
    .from("qac_departments")
    .select("id, name, qa_prompt")
    .eq("id", interaction.department_id)
    .eq("workspace_id", interaction.workspace_id)
    .maybeSingle();

  const department = deptRaw as {
    id: string;
    name: string;
    qa_prompt: string | null;
  } | null;

  if (!department) {
    await admin
      .from("qac_interactions")
      .update({ status: "manual_review_required" })
      .eq("id", interaction.id);
    return {
      ok: false,
      status: "manual_review_required",
      error: "Department not found",
    };
  }

  const trackers = await fetchQacTrackers(
    admin,
    interaction.workspace_id,
    department.id,
  );

  const { data: scorecardRaw } = await admin
    .from("qac_scorecards")
    .select(
      `id, name, qac_scorecard_criteria(
        id, category, name, description, weight, is_critical,
        applicability_rule, pass_definition, partial_definition,
        fail_definition, na_definition, examples_json, sort_order
      )`,
    )
    .eq("workspace_id", interaction.workspace_id)
    .eq("department_id", department.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const scorecard = scorecardRaw as {
    id: string;
    name: string;
    qac_scorecard_criteria: QacCriterion[] | null;
  } | null;

  const criteria = [...(scorecard?.qac_scorecard_criteria ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  if (!scorecard || criteria.length === 0) {
    await admin
      .from("qac_interactions")
      .update({ status: "analyzing" })
      .eq("id", interaction.id);

    const analysis = await groqJson<AnalysisJson>({
      system:
        "Return valid JSON only. Evaluate real call center interactions imported from CDR data.",
      prompt: buildPromptOnlyAnalysisPrompt({
        departmentName: department.name,
        departmentPrompt: department.qa_prompt,
        trackers,
        transcript,
      }),
      maxTokens: 3500,
      temperature: 0.1,
    });

    if (!analysis) {
      await admin
        .from("qac_interactions")
        .update({ status: "failed_analysis" })
        .eq("id", interaction.id);
      return {
        ok: false,
        status: "failed_analysis",
        error: "LLM did not return a valid prompt-only analysis",
      };
    }

    const trackerResults = normalizeTrackerResults(analysis);
    const impact = trackerImpact(trackers, trackerResults);
    const finalRisk = strongestRisk(
      normalizeRisk(analysis.risk_level),
      impact.riskLevel,
    );

    const { data: analysisRow, error: analysisError } = await admin
      .from("qac_analyses")
      .insert({
        workspace_id: interaction.workspace_id,
        interaction_id: interaction.id,
        scorecard_id: null,
        overall_score: null,
        sentiment: asString(analysis.sentiment) ?? "neutral",
        risk_level: finalRisk,
        call_disposition: asString(analysis.call_disposition),
        summary: asString(analysis.summary),
        strengths_json: asArray(analysis.strengths),
        opportunities_json: asArray(analysis.opportunities),
        recommendations_json: asArray(analysis.recommendations),
        trackers_json: {
          detected_objections: asArray(analysis.detected_objections),
          follow_up_detected: Boolean(analysis.follow_up_detected),
          tracker_results: trackerResults,
          tracker_risk_override: impact.riskLevel,
          requires_manual_review: impact.requiresManualReview,
          prompt_only: true,
          missing_scorecard_criteria: true,
        },
        raw_json: analysis,
      })
      .select("id")
      .single();

    if (analysisError || !analysisRow) {
      await admin
        .from("qac_interactions")
        .update({ status: "failed_analysis" })
        .eq("id", interaction.id);
      return {
        ok: false,
        status: "failed_analysis",
        error: analysisError?.message ?? "Prompt-only analysis insert failed",
      };
    }

    await admin
      .from("qac_interactions")
      .update({
        status: "analyzed",
        ...(impact.requiresManualReview ? { review_status: "in_review" } : {}),
      })
      .eq("id", interaction.id);

    return {
      ok: true,
      status: "analyzed",
      analysisId: (analysisRow as { id: string }).id,
    };
  }

  await admin
    .from("qac_interactions")
    .update({ status: "analyzing" })
    .eq("id", interaction.id);

  const analysis = await groqJson<AnalysisJson>({
    system:
      "Return valid JSON only. Evaluate real call center interactions imported from CDR data.",
    prompt: buildAnalysisPrompt({
      departmentName: department.name,
      departmentPrompt: department.qa_prompt,
      scorecardName: scorecard.name,
      criteria,
      trackers,
      transcript,
    }),
    maxTokens: 6000,
    temperature: 0.1,
  });

  if (!analysis || !Array.isArray(analysis.criteria_results)) {
    await admin
      .from("qac_interactions")
      .update({ status: "failed_analysis" })
      .eq("id", interaction.id);
    return {
      ok: false,
      status: "failed_analysis",
      error: "LLM did not return a valid criteria result set",
    };
  }

  const normalizedResults = analysis.criteria_results.map((result) => ({
    ...result,
    evidence_json: Array.isArray(result.evidence_json)
      ? result.evidence_json
      : Array.isArray(result.evidence)
        ? result.evidence
        : [],
  }));

  const score = calculateQacScore(criteria, normalizedResults);
  const finalStatus = score.notEvaluable ? "not_evaluable" : "analyzed";
  const trackerResults = normalizeTrackerResults(analysis);
  const impact = trackerImpact(trackers, trackerResults);
  const finalRisk = strongestRisk(
    normalizeRisk(analysis.risk_level),
    impact.riskLevel,
  );

  const { data: analysisRow, error: analysisError } = await admin
    .from("qac_analyses")
    .insert({
      workspace_id: interaction.workspace_id,
      interaction_id: interaction.id,
      scorecard_id: scorecard.id,
      overall_score: score.overallScore,
      sentiment: asString(analysis.sentiment) ?? "neutral",
      risk_level: finalRisk,
      call_disposition: asString(analysis.call_disposition),
      summary: asString(analysis.summary),
      strengths_json: asArray(analysis.strengths),
      opportunities_json: asArray(analysis.opportunities),
      recommendations_json: asArray(analysis.recommendations),
      trackers_json: {
        detected_objections: asArray(analysis.detected_objections),
        follow_up_detected: Boolean(analysis.follow_up_detected),
        tracker_results: trackerResults,
        tracker_risk_override: impact.riskLevel,
        requires_manual_review: impact.requiresManualReview,
        applicable_weight: score.applicableWeight,
        earned_points: score.earnedPoints,
      },
      raw_json: analysis,
    })
    .select("id")
    .single();

  if (analysisError || !analysisRow) {
    await admin
      .from("qac_interactions")
      .update({ status: "failed_analysis" })
      .eq("id", interaction.id);
    return {
      ok: false,
      status: "failed_analysis",
      error: analysisError?.message ?? "Analysis insert failed",
    };
  }

  const rows = score.results.map((result) => ({
    workspace_id: interaction.workspace_id,
    analysis_id: (analysisRow as { id: string }).id,
    criterion_id: result.criterion_id,
    applicable: result.applicable,
    result: result.result,
    score: result.score,
    reason: result.reason,
    evidence_json: result.evidence_json,
  }));

  if (rows.length > 0) {
    const { error } = await admin.from("qac_criteria_results").insert(rows);
    if (error) {
      await admin
        .from("qac_interactions")
        .update({ status: "failed_analysis" })
        .eq("id", interaction.id);
      return {
        ok: false,
        status: "failed_analysis",
        error: error.message,
      };
    }
  }

  await admin
    .from("qac_interactions")
    .update({
      status: finalStatus,
      ...(impact.requiresManualReview ? { review_status: "in_review" } : {}),
    })
    .eq("id", interaction.id);

  return {
    ok: true,
    status: finalStatus,
    analysisId: (analysisRow as { id: string }).id,
  };
}
