/**
 * POST /api/jobs/analyze-call
 *
 * Asynchronous post-call intelligence job. Triggered by the LiveKit room_finished
 * webhook. Extracts summary, disposition, and structured data from the transcript
 * via Groq, persists to DB, then fires post-call integration events (Telegram,
 * Teams, n8n, Google Calendar) via the dispatcher.
 *
 * Security: protected by INTERNAL_API_SECRET header.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { dispatchPostCallEvents } from '@/lib/integrations/dispatcher';
import { NextResponse } from 'next/server';

type CallDisposition =
  | 'meeting_booked'
  | 'not_interested'
  | 'voicemail'
  | 'follow_up'
  | 'callback_requested'
  | 'completed'
  | 'transferred'
  | 'other';

interface AnalysisResult {
  summary: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  disposition: CallDisposition;
  intent: string;
  extracted_name: string | null;
  extracted_email: string | null;
  extracted_interest: string | null;
  extracted_objections: string | null;
  extracted_data: Record<string, unknown> | null;
}

interface QAResult {
  score: number;
  feedback: string;
}

const VALID_DISPOSITIONS = new Set<CallDisposition>([
  'meeting_booked', 'not_interested', 'voicemail',
  'follow_up', 'callback_requested', 'completed', 'transferred', 'other',
]);

const EXTRACTION_PROMPT = `You are a call analysis expert. Analyze the following voice call transcript and return a JSON object with EXACTLY these fields:

- "summary": array of exactly 3 strings, each a bullet point summarizing a key moment (≤15 words each)
- "sentiment": exactly one of "positive", "neutral", or "negative" — the user's overall emotional tone
- "disposition": the AI-extracted sales/call outcome — MUST be exactly one of:
    "meeting_booked"     → prospect agreed to a meeting or appointment
    "not_interested"     → prospect declined or showed clear disinterest
    "voicemail"          → reached voicemail or an automated answering system
    "follow_up"          → conversation ended but a follow-up is needed
    "callback_requested" → caller explicitly asked to be called back later
    "completed"          → goal achieved without a more specific categorical outcome
    "transferred"        → call was handed off to a human agent
    "other"              → none of the above categories apply
- "intent": the user's primary objective or reason for calling, in ≤10 words
- "extracted_name": the user's full name if explicitly stated, otherwise null
- "extracted_email": the user's email address if mentioned, otherwise null
- "extracted_interest": the main product, service, or topic the user showed interest in, otherwise null
- "extracted_objections": the main objection, concern, or hesitation the user raised, otherwise null
- "extracted_data": a JSON object with any additional structured data mentioned in the call, including:
    - "budget": dollar amount or budget range mentioned, otherwise null
    - "meeting_date": specific date or time mentioned for a meeting (ISO-8601 if possible), otherwise null
    - "company": company name if mentioned, otherwise null
    - "phone": alternative phone number mentioned, otherwise null
    - Any other key facts worth capturing as key-value pairs

Respond with ONLY the raw JSON object — no markdown, no code fences, no explanation.

TRANSCRIPT:
`;

type AnalysisResponse = AnalysisResult & { _tokensUsed: number | null };

interface QACriterion { name: string; description: string | null; weight: number }

async function runQAScoring(
  transcript: string,
  systemPrompt: string | null,
  criteria: QACriterion[],
): Promise<QAResult | null> {
  const groqKey = process.env['GROQ_API_KEY'];
  if (!groqKey) return null;

  // Build the scoring section: prefer explicit criteria over raw system prompt
  let scoringSection: string;
  if (criteria.length > 0) {
    const totalWeight = criteria.reduce((s, c) => s + c.weight, 0) || 1;
    scoringSection = `SCORING CRITERIA (weighted — score each criterion proportionally to its weight):
${criteria.map(c => `- ${c.name} (${Math.round((c.weight / totalWeight) * 100)}% of score): ${c.description ?? ''}`).join('\n')}`;
  } else if (systemPrompt) {
    scoringSection = `AGENT INSTRUCTIONS (score how closely the agent followed these):
${systemPrompt.slice(0, 1500)}`;
  } else {
    scoringSection = 'SCORING: Evaluate overall call quality, professionalism, and helpfulness.';
  }

  const prompt = `You are a QA evaluator for AI voice agents.

${scoringSection}

CALL TRANSCRIPT:
${transcript.slice(0, 3000)}

Return ONLY a JSON object with:
- "score": integer 0-100 reflecting the weighted criteria above
- "feedback": one sentence noting what was done well and the main area for improvement

Respond with ONLY the raw JSON.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) return null;
  try {
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    const result = JSON.parse(data.choices[0]?.message?.content ?? '{}') as QAResult;
    if (typeof result.score !== 'number') return null;
    result.score = Math.max(0, Math.min(100, Math.round(result.score)));
    return result;
  } catch {
    return null;
  }
}

async function runGroqAnalysis(transcript: string): Promise<AnalysisResponse | null> {
  const groqKey = process.env['GROQ_API_KEY'];
  if (!groqKey) return null;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{ role: 'user', content: `${EXTRACTION_PROMPT}${transcript}` }],
      temperature: 0.1,
      max_tokens: 768,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage?: { total_tokens?: number };
  };

  try {
    const result = JSON.parse(data.choices[0]?.message?.content ?? '{}') as AnalysisResult;
    if (!VALID_DISPOSITIONS.has(result.disposition)) result.disposition = 'other';
    if (result.extracted_data && typeof result.extracted_data !== 'object') result.extracted_data = null;
    return { ...result, _tokensUsed: data.usage?.total_tokens ?? null };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env['INTERNAL_API_SECRET']) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { room_name } = await req.json() as { room_name: string };
  if (!room_name) return NextResponse.json({ error: 'room_name required' }, { status: 400 });

  const admin = createAdminClient();

  interface CallRow {
    id: string;
    workspace_id: string;
    agent_id: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    direction: string;
    duration_seconds: number;
    transcript: string | null;
    created_at: string;
  }

  interface AgentRow {
    system_prompt: string | null;
  }

  // Retry loop — the worker may still be writing the transcript when this fires
  let callRecord: CallRow | null = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * attempt));

    const { data } = await admin
      .from('calls')
      .select('id, workspace_id, agent_id, contact_name, contact_phone, direction, duration_seconds, transcript, created_at')
      .eq('retell_call_id', room_name)
      .single();

    const row = data as unknown as CallRow | null;
    if (row?.transcript) { callRecord = row; break; }
    callRecord = row;
  }

  if (!callRecord) {
    return NextResponse.json({ error: 'Call record not found', room_name }, { status: 404 });
  }

  if (!callRecord.transcript || callRecord.transcript.length < 50) {
    console.warn('analyze-call: no transcript after 4 attempts', { room_name });
    return NextResponse.json({ skipped: true, reason: 'Transcript too short for analysis' });
  }

  const [analysis, agentData, criteriaRows] = await Promise.all([
    runGroqAnalysis(callRecord.transcript),
    callRecord.agent_id
      ? admin.from('agents').select('system_prompt').eq('id', callRecord.agent_id).single()
          .then(r => (r.data as unknown as AgentRow | null))
      : Promise.resolve(null),
    callRecord.agent_id
      ? admin.from('qa_criteria').select('name, description, weight').eq('agent_id', callRecord.agent_id)
          .order('created_at').then(r => (r.data as QACriterion[] | null) ?? [])
      : Promise.resolve([]),
  ]);

  if (!analysis) {
    return NextResponse.json({ error: 'Analysis failed — Groq unavailable' }, { status: 502 });
  }

  const summaryText = Array.isArray(analysis.summary)
    ? analysis.summary.join('\n• ').replace(/^/, '• ')
    : String(analysis.summary ?? '');

  // Step 1: core fields — exist in schema from migration 001
  const { error } = await admin
    .from('calls')
    .update({
      summary:              summaryText,
      sentiment:            analysis.sentiment ?? null,
      extracted_name:       analysis.extracted_name ?? null,
      extracted_email:      analysis.extracted_email ?? null,
      extracted_interest:   analysis.extracted_interest ?? null,
      extracted_objections: analysis.extracted_objections ?? null,
      task_completed:       analysis.disposition === 'meeting_booked' || analysis.sentiment === 'positive',
    })
    .eq('id', callRecord.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Step 2: extended columns from later migrations
  await admin
    .from('calls')
    .update({
      disposition:    analysis.disposition ?? 'other',
      tokens_used:    analysis._tokensUsed ?? null,
      extracted_data: analysis.extracted_data ?? null,
    })
    .eq('id', callRecord.id)
    .then(({ error: e }) => {
      if (e) console.warn('[analyze-call] extended update failed:', e.message);
    });

  // Step 3: Auto-QA — score transcript using explicit criteria (preferred) or system prompt
  const systemPrompt = agentData?.system_prompt ?? null;
  const hasScoringBasis = (criteriaRows as QACriterion[]).length > 0 || (systemPrompt && systemPrompt.length > 20);
  if (hasScoringBasis) {
    const qa = await runQAScoring(callRecord.transcript, systemPrompt, criteriaRows as QACriterion[]);
    if (qa) {
      await admin
        .from('calls')
        .update({ qa_score: qa.score, qa_feedback: qa.feedback })
        .eq('id', callRecord.id)
        .then(({ error: e }) => {
          if (e) console.warn('[analyze-call] qa update failed:', e.message);
        });
    }
  }

  // Step 4: fire integration dispatchers (Telegram, Teams, n8n, Google Calendar)
  // Non-blocking — dispatch runs in background, never delays the HTTP response
  dispatchPostCallEvents(callRecord.workspace_id, {
    call_id:              callRecord.id,
    workspace_id:         callRecord.workspace_id,
    agent_id:             callRecord.agent_id,
    contact_name:         callRecord.contact_name,
    contact_phone:        callRecord.contact_phone,
    direction:            callRecord.direction,
    duration_seconds:     callRecord.duration_seconds,
    disposition:          analysis.disposition,
    summary:              summaryText,
    sentiment:            analysis.sentiment,
    transcript:           callRecord.transcript,
    extracted_data:       analysis.extracted_data ?? null,
    extracted_name:       analysis.extracted_name ?? null,
    extracted_email:      analysis.extracted_email ?? null,
    extracted_interest:   analysis.extracted_interest ?? null,
    extracted_objections: analysis.extracted_objections ?? null,
    created_at:           callRecord.created_at,
  }).catch(() => null);

  return NextResponse.json({
    analyzed:    true,
    call_id:     callRecord.id,
    sentiment:   analysis.sentiment,
    disposition: analysis.disposition,
    intent:      analysis.intent,
  });
}
