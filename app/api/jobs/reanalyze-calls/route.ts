/**
 * POST /api/jobs/reanalyze-calls
 *
 * Re-scores calls that have a transcript but no qa_score yet.
 * Runs Groq QA scoring INLINE (no HTTP chain) so it's reliable
 * regardless of NEXT_PUBLIC_APP_URL or function-to-function routing.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface QACriterion { name: string; description: string | null; weight: number }

async function scoreCall(
  transcript: string,
  systemPrompt: string | null,
  criteria: QACriterion[],
): Promise<{ score: number; feedback: string } | null> {
  const groqKey = process.env['GROQ_API_KEY'];
  if (!groqKey) return null;

  let scoringSection: string;
  if (criteria.length > 0) {
    const totalWeight = criteria.reduce((s, c) => s + c.weight, 0) || 1;
    scoringSection = `SCORING CRITERIA (weighted):\n${criteria
      .map(c => `- ${c.name} (${Math.round((c.weight / totalWeight) * 100)}% of score): ${c.description ?? ''}`)
      .join('\n')}`;
  } else if (systemPrompt) {
    scoringSection = `AGENT INSTRUCTIONS:\n${systemPrompt.slice(0, 1500)}`;
  } else {
    scoringSection = 'Evaluate overall call quality, professionalism, and helpfulness.';
  }

  const prompt = `You are a QA evaluator for AI voice agents.

${scoringSection}

CALL TRANSCRIPT:
${transcript.slice(0, 3000)}

Return ONLY a JSON object:
- "score": integer 0-100 reflecting the weighted criteria
- "feedback": one sentence noting the main strength and area for improvement

Respond with ONLY the raw JSON.`;

  try {
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
    const data = await res.json() as { choices: { message: { content: string } }[] };
    const result = JSON.parse(data.choices[0]?.message?.content ?? '{}') as { score?: number; feedback?: string };
    if (typeof result.score !== 'number') return null;
    return {
      score:    Math.max(0, Math.min(100, Math.round(result.score))),
      feedback: result.feedback ?? '',
    };
  } catch {
    return null;
  }
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groqKey = process.env['GROQ_API_KEY'] ?? '';
  if (!groqKey) {
    return NextResponse.json({
      error: 'GROQ_API_KEY is not configured. Add it in your environment variables (Render → Settings → Environment Variables).',
      code: 'MISSING_GROQ_KEY',
    }, { status: 503 });
  }

  const admin = createAdminClient();

  const { data: ws } = await admin
    .from('workspaces').select('id').eq('owner_id', user.id).single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const workspaceId = (ws as { id: string }).id;

  // Calls with transcript but no qa_score
  const { data: calls } = await admin
    .from('calls')
    .select('id, agent_id, transcript')
    .eq('workspace_id', workspaceId)
    .is('qa_score', null)
    .not('transcript', 'is', null)
    .limit(50);

  type CallRow = { id: string; agent_id: string | null; transcript: string | null };
  const eligible = ((calls ?? []) as CallRow[]).filter(c => c.transcript && c.transcript.length >= 50);

  if (eligible.length === 0) {
    return NextResponse.json({
      scored: 0,
      message: 'No eligible calls found (need transcript ≥50 chars and no qa_score yet).',
    });
  }

  // Pre-fetch criteria and system prompts for all unique agents
  const agentIds = [...new Set(eligible.map(c => c.agent_id).filter(Boolean))] as string[];

  const [criteriaResults, agentResults] = await Promise.all([
    Promise.all(agentIds.map(id =>
      admin.from('qa_criteria').select('name, description, weight').eq('agent_id', id)
        .then(r => ({ id, rows: (r.data ?? []) as QACriterion[] }))
    )),
    Promise.all(agentIds.map(id =>
      admin.from('agents').select('system_prompt').eq('id', id).single()
        .then(r => ({ id, prompt: (r.data as { system_prompt: string | null } | null)?.system_prompt ?? null }))
    )),
  ]);

  const criteriaMap = Object.fromEntries(criteriaResults.map(r => [r.id, r.rows]));
  const promptMap   = Object.fromEntries(agentResults.map(r => [r.id, r.prompt]));

  // Score each call inline — process up to 10 concurrently
  let scored = 0;
  let failed = 0;

  const CONCURRENCY = 5;
  for (let i = 0; i < eligible.length; i += CONCURRENCY) {
    const batch = eligible.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (call) => {
      const criteria   = call.agent_id ? (criteriaMap[call.agent_id] ?? []) : [];
      const sysPrompt  = call.agent_id ? (promptMap[call.agent_id] ?? null) : null;
      const hasBasis   = criteria.length > 0 || (sysPrompt && sysPrompt.length > 20);
      if (!hasBasis) return; // no way to score without criteria or prompt

      const qa = await scoreCall(call.transcript!, sysPrompt, criteria);
      if (!qa) { failed++; return; }

      const { error } = await admin
        .from('calls')
        .update({ qa_score: qa.score, qa_feedback: qa.feedback })
        .eq('id', call.id);

      if (error) {
        console.error('[reanalyze] update failed', call.id, error.message);
        failed++;
      } else {
        scored++;
      }
    }));
  }

  return NextResponse.json({
    eligible: eligible.length,
    scored,
    failed,
    message: scored > 0
      ? `✓ ${scored} llamada(s) puntuadas. Recarga la página para ver los resultados.`
      : failed > 0
        ? `Groq procesó las llamadas pero ${failed} actualizaciones fallaron. Revisa los logs.`
        : 'No se encontraron llamadas con criterios o system prompt configurado.',
  });
}
