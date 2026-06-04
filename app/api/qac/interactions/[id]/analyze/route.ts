/**
 * QA Center — Analyze Interaction
 * Runs the AI auditor on a single human-agent interaction.
 * Checks against the workspace's active qac_rules and produces:
 *   - overall score (0–100, higher = better)
 *   - risk score (0–100, higher = more dangerous)
 *   - criteria scores (opening, compliance, objection_handling, closing, empathy)
 *   - flags per violation with regulation reference and coaching note
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

interface QACRule {
  name: string;
  description: string;
  category: string;
  severity: string;
  regulation: string | null;
}

interface QACFlag {
  category: string;
  severity: string;
  label: string;
  transcript_fragment?: string;
  regulation?: string;
  coaching_note?: string;
  timestamp_s?: number;
}

interface QACAnalysisResult {
  overall_score:   number;
  risk_score:      number;
  tone:            string;
  summary:         string;
  criteria_scores: {
    opening:              number;
    compliance:           number;
    objection_handling:   number;
    closing:              number;
    empathy:              number;
  };
  flags: QACFlag[];
}

const CRITERIA_LABELS = {
  opening:             'Call opening (introduction, company name, purpose, consent)',
  compliance:          'Adherence to regulations (disclosures, opt-outs, required statements)',
  objection_handling:  'Handling of objections, pushback, and hardship situations',
  closing:             'Call closing (next steps, confirmation, professional farewell)',
  empathy:             'Tone, empathy, and respect throughout the interaction',
};

async function analyzeInteraction(
  transcript: string,
  rules:      QACRule[],
): Promise<QACAnalysisResult | null> {
  const groqKey = process.env['GROQ_API_KEY'];
  if (!groqKey) return null;

  const rulesSection = rules.length > 0
    ? rules.map((r, i) =>
        `${i + 1}. [${r.severity.toUpperCase()}] "${r.name}" (${r.category})${r.regulation ? ` — ${r.regulation}` : ''}\n   ${r.description}`
      ).join('\n')
    : 'No custom rules defined. Apply universal call-center compliance and quality standards.';

  const criteriaSection = Object.entries(CRITERIA_LABELS)
    .map(([k, v]) => `  - "${k}": ${v}`)
    .join('\n');

  const prompt = `You are an expert call-center QA auditor. Your job is to evaluate a human agent's transcript for compliance, quality, and coaching opportunities — exactly like a 100% QA system (not manual sampling).

WORKSPACE QA RULES (check every interaction against these):
${rulesSection}

SCORING CRITERIA (score each 0–100, where 100 = perfect):
${criteriaSection}

TRANSCRIPT:
${transcript.slice(0, 8000)}

Return ONLY a JSON object with EXACTLY these fields:
{
  "overall_score": integer 0–100 (weighted average of criteria scores — 100 = flawless performance),
  "risk_score": integer 0–100 (0 = no risk, 100 = immediate regulatory/legal exposure),
  "tone": one of "professional" | "neutral" | "unprofessional" | "aggressive" | "friendly",
  "summary": one sentence (≤25 words) describing the agent's performance and any critical findings,
  "criteria_scores": {
    "opening": integer 0–100,
    "compliance": integer 0–100,
    "objection_handling": integer 0–100,
    "closing": integer 0–100,
    "empathy": integer 0–100
  },
  "flags": array of flagged issues (can be empty if none), each with:
    {
      "category": one of "compliance" | "quality" | "disclosure" | "prohibited" | "coaching",
      "severity": one of "low" | "medium" | "high" | "critical",
      "label": short name ≤8 words (e.g. "Missing FDCPA Mini-Miranda", "Aggressive tone with debtor"),
      "transcript_fragment": exact quote ≤60 words where the issue occurred (null if not applicable),
      "regulation": specific regulation/standard reference (e.g. "FDCPA §807(11)", "TCPA 47 U.S.C. §227", "GDPR Art.13") or null,
      "coaching_note": concrete 1-sentence action the agent should take differently next time,
      "timestamp_s": estimated second in the call when this occurred (null if unknown)
    }
}

Be precise and audit-ready. Each flag must be justifiable with evidence from the transcript.
Respond with ONLY the raw JSON — no markdown, no code fences.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
    body: JSON.stringify({
      model:           'meta-llama/llama-4-scout-17b-16e-instruct',
      messages:        [{ role: 'user', content: prompt }],
      temperature:     0.1,
      max_tokens:      2048,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) return null;

  try {
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    const result = JSON.parse(data.choices[0]?.message?.content ?? '{}') as QACAnalysisResult;

    // Sanitize scores
    result.overall_score = Math.max(0, Math.min(100, Math.round(Number(result.overall_score) || 0)));
    result.risk_score    = Math.max(0, Math.min(100, Math.round(Number(result.risk_score)    || 0)));

    if (result.criteria_scores) {
      for (const key of Object.keys(result.criteria_scores) as (keyof typeof result.criteria_scores)[]) {
        result.criteria_scores[key] = Math.max(0, Math.min(100, Math.round(Number(result.criteria_scores[key]) || 0)));
      }
    }

    if (!Array.isArray(result.flags)) result.flags = [];

    const VALID_CATEGORIES = new Set(['compliance', 'quality', 'disclosure', 'prohibited', 'coaching']);
    const VALID_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);

    result.flags = result.flags.map(f => ({
      ...f,
      category: VALID_CATEGORIES.has(f.category) ? f.category : 'quality',
      severity: VALID_SEVERITIES.has(f.severity) ? f.severity : 'medium',
      label:    f.label ?? 'Unknown issue',
    }));

    return result;
  } catch {
    return null;
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // Resolve workspace
  const { data: wsData } = await admin
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  const workspace = wsData as { id: string } | null;
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  // Verify interaction belongs to this workspace
  const { data: intData } = await admin
    .from('qac_interactions')
    .select('id, workspace_id, transcript, status')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .single();

  const interaction = intData as { id: string; workspace_id: string; transcript: string; status: string } | null;
  if (!interaction) return NextResponse.json({ error: 'Interaction not found' }, { status: 404 });

  if (interaction.status === 'analyzing') {
    return NextResponse.json({ error: 'Analysis already in progress' }, { status: 409 });
  }

  // Lock the interaction while analyzing
  await admin.from('qac_interactions').update({ status: 'analyzing' }).eq('id', id);

  // Fetch active QA rules for this workspace
  const { data: rulesData } = await admin
    .from('qac_rules')
    .select('name, description, category, severity, regulation')
    .eq('workspace_id', workspace.id)
    .eq('is_active', true);

  const rules = (rulesData ?? []) as QACRule[];

  // Run the AI auditor
  const result = await analyzeInteraction(interaction.transcript, rules);

  if (!result) {
    await admin.from('qac_interactions').update({ status: 'failed' }).eq('id', id);
    return NextResponse.json({ error: 'Analysis failed — AI service unavailable' }, { status: 502 });
  }

  // Save evaluation
  const { data: evalData, error: evalErr } = await admin
    .from('qac_evaluations')
    .insert({
      workspace_id:    workspace.id,
      interaction_id:  id,
      overall_score:   result.overall_score,
      risk_score:      result.risk_score,
      tone:            result.tone ?? null,
      summary:         result.summary ?? null,
      criteria_scores: result.criteria_scores ?? {},
      rules_applied:   rules.length,
    })
    .select('id')
    .single();

  if (evalErr || !evalData) {
    await admin.from('qac_interactions').update({ status: 'failed' }).eq('id', id);
    return NextResponse.json({ error: 'Failed to save evaluation' }, { status: 500 });
  }

  const evalId = (evalData as { id: string }).id;

  // Save flags
  if (result.flags.length > 0) {
    await admin.from('qac_flags').insert(
      result.flags.map(f => ({
        evaluation_id:       evalId,
        workspace_id:        workspace.id,
        category:            f.category,
        severity:            f.severity,
        label:               f.label,
        transcript_fragment: f.transcript_fragment ?? null,
        regulation:          f.regulation ?? null,
        coaching_note:       f.coaching_note ?? null,
        timestamp_s:         f.timestamp_s ?? null,
      }))
    );
  }

  // Mark analyzed
  await admin.from('qac_interactions').update({ status: 'analyzed' }).eq('id', id);

  return NextResponse.json({
    ok:            true,
    evaluation_id: evalId,
    overall_score: result.overall_score,
    risk_score:    result.risk_score,
    flags:         result.flags.length,
    tone:          result.tone,
  });
}
