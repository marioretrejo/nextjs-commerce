import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { subDays } from 'date-fns';

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const since = subDays(new Date(), 30).toISOString();

  const [{ data: agentData }, { data: callsData }] = await Promise.all([
    admin.from('agents').select('*').eq('id', id).single(),
    admin
      .from('calls')
      .select('duration_seconds, outcome, sentiment, qa_score, created_at')
      .eq('agent_id', id)
      .gte('created_at', since),
  ]);

  if (!agentData) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const calls = callsData ?? [];
  const totalCalls = calls.length;
  const avgDuration = totalCalls > 0
    ? Math.round(calls.reduce((s, c) => s + (c.duration_seconds ?? 0), 0) / totalCalls)
    : 0;
  const converted = calls.filter(c => c.outcome === 'converted').length;
  const conversionRate = totalCalls > 0 ? Math.round((converted / totalCalls) * 100) : 0;
  const scoredCalls = calls.filter(c => c.qa_score !== null);
  const avgQaScore = scoredCalls.length > 0
    ? Math.round(scoredCalls.reduce((s, c) => s + (c.qa_score ?? 0), 0) / scoredCalls.length)
    : null;
  const positiveCount = calls.filter(c => c.sentiment === 'positive').length;
  const negativeCount = calls.filter(c => c.sentiment === 'negative').length;
  const sentimentScore = totalCalls > 0 ? Math.round((positiveCount / totalCalls) * 100) : 0;

  // Outcome distribution
  const outcomes: Record<string, number> = {};
  calls.forEach(c => {
    if (c.outcome) outcomes[c.outcome] = (outcomes[c.outcome] ?? 0) + 1;
  });

  const kpis = {
    totalCalls,
    avgDuration,
    conversionRate,
    avgQaScore,
    sentimentScore,
    positiveCount,
    negativeCount,
    outcomes,
  };

  // AI recommendations (only if Anthropic key is set)
  let recommendations: string[] = [];
  const anthropicKey = process.env['ANTHROPIC_API_KEY'];
  if (anthropicKey && totalCalls >= 3) {
    try {
      const prompt = `You are a voice AI performance analyst. Here are the stats for agent "${agentData.name}" in the last 30 days:
- Total calls: ${totalCalls}
- Conversion rate: ${conversionRate}%
- Average call duration: ${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s
- Average QA score: ${avgQaScore !== null ? avgQaScore + '/100' : 'not scored'}
- Positive sentiment: ${sentimentScore}%
- Outcomes: ${JSON.stringify(outcomes)}
- Agent objective: ${agentData.objective ?? 'not set'}

Provide exactly 3 specific, actionable recommendations to improve this agent's performance. Each recommendation should be 1–2 sentences. Format as a JSON array of strings.`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (res.ok) {
        const data = await res.json() as { content: { type: string; text: string }[] };
        const text = data.content?.[0]?.text ?? '';
        const match = text.match(/\[[\s\S]*?\]/);
        if (match) {
          const parsed = JSON.parse(match[0]) as string[];
          recommendations = Array.isArray(parsed) ? parsed.slice(0, 3) : [];
        }
      }
    } catch {
      // AI recommendations are optional — silently skip on error
    }
  }

  if (!recommendations.length) {
    // Fallback rule-based recommendations
    if (conversionRate < 20) recommendations.push('Your conversion rate is below 20%. Consider reviewing and sharpening the agent\'s opening message to qualify prospects faster.');
    if (avgDuration > 300) recommendations.push('Average call duration exceeds 5 minutes. Tighten the system prompt to help the agent reach its objective more efficiently.');
    if (avgQaScore !== null && avgQaScore < 70) recommendations.push('QA score is below 70. Review recent low-scoring calls in the Quality tab and update the system prompt to address common weaknesses.');
    if (sentimentScore < 50) recommendations.push('More than half of callers show neutral or negative sentiment. Adjust the agent\'s personality to be warmer and more empathetic.');
    if (recommendations.length === 0) {
      recommendations.push('Performance looks solid! Keep monitoring QA scores and A/B test new first-message variations to push conversion rates higher.');
    }
  }

  return NextResponse.json({ kpis, recommendations, agentName: agentData.name });
}
