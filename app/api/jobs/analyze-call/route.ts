/**
 * POST /api/jobs/analyze-call
 *
 * Asynchronous post-call intelligence job. Triggered by the LiveKit room_finished
 * webhook. Takes the raw transcript, sends it to Groq for structured extraction,
 * and writes the results back to the calls table.
 *
 * Security: protected by INTERNAL_API_SECRET header.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

interface AnalysisResult {
  summary: string[];          // 3 bullet points
  sentiment: 'positive' | 'neutral' | 'negative';
  intent: string;             // user's primary goal in ≤10 words
  extracted_name: string | null;
  extracted_email: string | null;
  extracted_interest: string | null;
  extracted_objections: string | null;
}

const EXTRACTION_PROMPT = `You are a call analysis expert. Analyze the following voice call transcript and return a JSON object with EXACTLY these fields:

- "summary": array of exactly 3 strings, each a bullet point summarizing a key moment (≤15 words each)
- "sentiment": exactly one of "positive", "neutral", or "negative" — the user's overall emotional tone
- "intent": the user's primary objective or reason for calling, in ≤10 words
- "extracted_name": the user's full name if explicitly stated, otherwise null
- "extracted_email": the user's email address if mentioned, otherwise null
- "extracted_interest": the main product, service, or topic the user showed interest in, otherwise null
- "extracted_objections": the main objection, concern, or hesitation the user raised, otherwise null

Respond with ONLY the raw JSON object — no markdown, no code fences, no explanation.

TRANSCRIPT:
`;

type AnalysisResponse = AnalysisResult & { _tokensUsed: number | null };

async function runGroqAnalysis(transcript: string): Promise<AnalysisResponse | null> {
  const groqKey = process.env['GROQ_API_KEY'];
  if (!groqKey) return null;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}${transcript}`,
        },
      ],
      temperature: 0.1, // low temp for consistent structured output
      max_tokens: 512,
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
    return { ...result, _tokensUsed: data.usage?.total_tokens ?? null };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // Verify internal secret — this endpoint must not be publicly accessible
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env['INTERNAL_API_SECRET']) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { room_name } = await req.json() as { room_name: string };
  if (!room_name) return NextResponse.json({ error: 'room_name required' }, { status: 400 });

  const admin = createAdminClient();

  // Retry loop — the worker may still be writing the transcript when this fires
  let callRecord: { id: string; transcript: string | null } | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * attempt));

    const { data } = await admin
      .from('calls')
      .select('id, transcript')
      .eq('retell_call_id', room_name)
      .single();

    if (data?.transcript) {
      callRecord = data as { id: string; transcript: string };
      break;
    }
    callRecord = data as { id: string; transcript: string | null } | null;
  }

  if (!callRecord) {
    return NextResponse.json({ error: 'Call record not found', room_name }, { status: 404 });
  }

  if (!callRecord.transcript || callRecord.transcript.length < 50) {
    return NextResponse.json({ skipped: true, reason: 'Transcript too short for analysis' });
  }

  const analysis = await runGroqAnalysis(callRecord.transcript);
  if (!analysis) {
    return NextResponse.json({ error: 'Analysis failed — Groq unavailable' }, { status: 502 });
  }

  const { error } = await admin
    .from('calls')
    .update({
      summary: Array.isArray(analysis.summary)
        ? analysis.summary.join('\n• ').replace(/^/, '• ')
        : analysis.summary,
      sentiment: analysis.sentiment ?? null,
      extracted_name: analysis.extracted_name ?? null,
      extracted_email: analysis.extracted_email ?? null,
      extracted_interest: analysis.extracted_interest ?? null,
      extracted_objections: analysis.extracted_objections ?? null,
      task_completed: analysis.sentiment === 'positive',
      tokens_used: analysis._tokensUsed ?? null,
    })
    .eq('id', callRecord.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    analyzed: true,
    call_id: callRecord.id,
    sentiment: analysis.sentiment,
    intent: analysis.intent,
  });
}
