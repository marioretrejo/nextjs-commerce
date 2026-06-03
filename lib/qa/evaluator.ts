/**
 * lib/qa/evaluator.ts
 * Post-call QA evaluation engine.
 *
 * runPostCallQA() fetches active compliance rules for the workspace,
 * runs analysis against the transcript (mock today, LLM-ready architecture),
 * and persists results to qa_evaluations + compliance_violations.
 */
import { createAdminClient } from '@/lib/supabase/admin';

// ── Types ────────────────────────────────────────────────────────────────────

export interface QARule {
  id:          string;
  rule_name:   string;
  description: string;
  category:    string;
  severity:    'low' | 'medium' | 'high' | 'critical';
  is_active:   boolean;
}

export interface RuleViolation {
  ruleId:              string;
  ruleName:            string;
  severity:            QARule['severity'];
  regulation:          string;
  transcriptFragment:  string;
  remediationNote:     string;
  occurredAtSecond:    number | null;
}

export interface QAResult {
  evaluationId:    string;
  riskScore:       number;
  violationsCount: number;
  analysis: {
    summary:   string;
    sentiment: 'positive' | 'neutral' | 'negative';
    tone:      string;
    topics:    string[];
    scores: {
      opening:             number;
      compliance:          number;
      objection_handling:  number;
      closing:             number;
      overall:             number;
    };
  };
}

// ── Mock analysis engine ─────────────────────────────────────────────────────
// Each rule's description is checked against the transcript using keyword
// heuristics. Replace analyzeRule() with an LLM call for production.

const CATEGORY_REGULATION: Record<string, string> = {
  disclosure: 'FTC',
  prohibited: 'TCPA',
  required:   'Internal Policy',
  quality:    'Quality Standard',
  general:    'Internal Policy',
};

function analyzeRule(rule: QARule, transcript: string): RuleViolation | null {
  // TODO: Replace with LLM call:
  // const result = await anthropic.messages.create({
  //   model: 'claude-sonnet-4-6',
  //   system: `You are a compliance evaluator. Given a call transcript and a rule,
  //            determine if the rule was violated. Respond in JSON.`,
  //   messages: [{ role: 'user', content: `Rule: ${rule.description}\nTranscript: ${transcript}` }],
  // });

  const lower = transcript.toLowerCase();
  const ruleWords = rule.description
    .toLowerCase()
    .replace(/[^a-záéíóúñ\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4);

  // Check if key concepts from the rule description appear in the transcript
  const matchCount = ruleWords.filter(w => lower.includes(w)).length;
  const matchRatio = ruleWords.length > 0 ? matchCount / ruleWords.length : 0;

  // Violation = key concepts NOT present when they should be (required/disclosure)
  // or ARE present when they shouldn't be (prohibited)
  const isViolation = rule.category === 'prohibited'
    ? matchRatio > 0.4   // prohibited phrase found → violation
    : matchRatio < 0.3;  // required phrase not found → violation

  if (!isViolation) return null;

  // Extract a representative fragment from the transcript (first 200 chars near a keyword)
  const firstKeyword = ruleWords.find(w => lower.includes(w));
  let fragment = '';
  if (firstKeyword) {
    const idx = lower.indexOf(firstKeyword);
    fragment = transcript.slice(Math.max(0, idx - 40), idx + 120).trim();
  } else {
    fragment = transcript.slice(0, 160).trim();
  }

  const remediation: Record<string, string> = {
    disclosure: `Agent must explicitly state: "${rule.description.slice(0, 80)}…" during the call.`,
    prohibited: `Remove or rephrase the content identified. Review script for compliance.`,
    required:   `Add mandatory language to agent script: ${rule.rule_name}.`,
    quality:    `Coach agent on quality standard: ${rule.rule_name}.`,
    general:    `Review agent script to address: ${rule.rule_name}.`,
  };

  return {
    ruleId:             rule.id,
    ruleName:           rule.rule_name,
    severity:           rule.severity,
    regulation:         CATEGORY_REGULATION[rule.category] ?? 'Internal Policy',
    transcriptFragment: fragment || '(no relevant fragment found)',
    remediationNote:    remediation[rule.category] ?? remediation['general']!,
    occurredAtSecond:   null,
  };
}

function computeRiskScore(violations: RuleViolation[]): number {
  if (!violations.length) return 0;
  const weights: Record<QARule['severity'], number> = {
    low: 5, medium: 15, high: 30, critical: 50,
  };
  const raw = violations.reduce((sum, v) => sum + (weights[v.severity] ?? 10), 0);
  return Math.min(100, raw);
}

function deriveSentiment(transcript: string): 'positive' | 'neutral' | 'negative' {
  const lower = transcript.toLowerCase();
  const pos = ['great', 'perfect', 'thank you', 'excellent', 'appreciate', 'wonderful', 'happy'].filter(w => lower.includes(w)).length;
  const neg = ['angry', 'frustrated', "don't want", 'stop calling', 'remove', 'lawsuit', 'refuse'].filter(w => lower.includes(w)).length;
  if (neg > pos) return 'negative';
  if (pos > 1)   return 'positive';
  return 'neutral';
}

function extractTopics(transcript: string): string[] {
  const topics: Record<string, string[]> = {
    'Investment':  ['invest', 'portfolio', 'returns', 'fund', 'asset'],
    'Insurance':   ['insurance', 'policy', 'premium', 'coverage', 'claim'],
    'Sales':       ['pricing', 'discount', 'offer', 'package', 'deal'],
    'Appointment': ['schedule', 'meeting', 'calendar', 'appointment', 'demo'],
    'Support':     ['issue', 'problem', 'help', 'support', 'resolve'],
  };
  const lower = transcript.toLowerCase();
  return Object.entries(topics)
    .filter(([, words]) => words.some(w => lower.includes(w)))
    .map(([topic]) => topic);
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function runPostCallQA(
  callId:      string,
  transcript:  string,
  workspaceId: string,
): Promise<QAResult> {
  const admin = createAdminClient();

  // 1. Fetch active rules for this workspace
  const { data: rules, error: rulesErr } = await admin
    .from('compliance_rules')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  if (rulesErr) throw new Error(`Failed to fetch rules: ${rulesErr.message}`);

  const activeRules = (rules ?? []) as QARule[];

  // 2. Evaluate each rule against the transcript
  const violations: RuleViolation[] = activeRules
    .map(r => analyzeRule(r, transcript))
    .filter((v): v is RuleViolation => v !== null);

  const riskScore  = computeRiskScore(violations);
  const sentiment  = deriveSentiment(transcript);
  const topics     = extractTopics(transcript);

  // 3. Compute section scores (mock heuristics)
  const complianceScore = Math.max(0, 100 - riskScore);
  const scores = {
    opening:            transcript.length > 100 ? 75 + Math.floor(Math.random() * 20) : 50,
    compliance:         complianceScore,
    objection_handling: 60 + Math.floor(Math.random() * 30),
    closing:            55 + Math.floor(Math.random() * 35),
    overall:            Math.round((complianceScore + 70) / 2),
  };

  const analysis = {
    summary:   violations.length
      ? `Call flagged with ${violations.length} compliance issue(s). Risk score: ${riskScore}/100. Primary concern: ${violations[0]!.ruleName}.`
      : `Call passed all ${activeRules.length} active compliance rules. Risk score: ${riskScore}/100.`,
    sentiment,
    tone: sentiment === 'positive' ? 'friendly' : sentiment === 'negative' ? 'tense' : 'neutral',
    topics: topics.length ? topics : ['General'],
    scores,
  };

  // 4. Persist qa_evaluation
  const { data: evaluation, error: evalErr } = await admin
    .from('qa_evaluations')
    .insert({
      workspace_id:  workspaceId,
      call_id:       callId || null,
      risk_score:    riskScore,
      analysis,
    })
    .select('id')
    .single();

  if (evalErr) throw new Error(`Failed to save evaluation: ${evalErr.message}`);
  const evaluationId = (evaluation as { id: string }).id;

  // 5. Persist violations
  if (violations.length > 0) {
    const rows = violations.map(v => ({
      qa_evaluation_id:   evaluationId,
      workspace_id:       workspaceId,
      rule_name:          v.ruleName,
      severity:           v.severity,
      transcript_fragment: v.transcriptFragment,
      regulation:         v.regulation,
      remediation_note:   v.remediationNote,
      occurred_at_second: v.occurredAtSecond,
    }));

    const { error: vErr } = await admin.from('compliance_violations').insert(rows);
    if (vErr) console.error('qa: failed to save violations', vErr.message);
  }

  return { evaluationId, riskScore, violationsCount: violations.length, analysis };
}
