import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

type ToolInput = Record<string, unknown>;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_workspace_stats',
    description: 'Get overall workspace stats: total calls, minutes used/limit, plan, active agents count.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period_days: { type: 'number', description: 'Days to look back (default 30)' },
      },
      required: [],
    },
  },
  {
    name: 'get_campaign_metrics',
    description: 'Get campaign performance: call volume, completion rate, status breakdown.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string', description: 'Filter to a specific campaign (optional)' },
        period_days: { type: 'number', description: 'Days to look back (default 30)' },
      },
      required: [],
    },
  },
  {
    name: 'get_call_durations',
    description: 'Get call duration statistics: avg, p50, p95 in seconds.',
    input_schema: {
      type: 'object' as const,
      properties: {
        agent_id: { type: 'string', description: 'Filter to a specific agent (optional)' },
        period_days: { type: 'number', description: 'Days to look back (default 30)' },
      },
      required: [],
    },
  },
  {
    name: 'get_success_rates',
    description: 'Get task-completion % and sentiment breakdown (positive/neutral/negative).',
    input_schema: {
      type: 'object' as const,
      properties: {
        agent_id: { type: 'string', description: 'Filter to a specific agent (optional)' },
        period_days: { type: 'number', description: 'Days to look back (default 30)' },
      },
      required: [],
    },
  },
  {
    name: 'get_top_agents',
    description: 'List top-performing agents ranked by call volume or success rate.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit:   { type: 'number', description: 'How many agents to return (default 5)' },
        rank_by: { type: 'string', enum: ['call_volume', 'success_rate'], description: 'Ranking criterion' },
      },
      required: [],
    },
  },
];

async function executeTool(
  name: string,
  args: ToolInput,
  workspaceId: string,
): Promise<string> {
  const admin = createAdminClient();
  const days  = Number(args['period_days'] ?? 30);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  switch (name) {
    case 'get_workspace_stats': {
      const [callsRes, agentsRes, wsRes] = await Promise.all([
        admin.from('calls').select('duration_seconds', { count: 'exact' })
          .eq('workspace_id', workspaceId).gte('created_at', since),
        admin.from('agents').select('id', { count: 'exact' })
          .eq('workspace_id', workspaceId),
        admin.from('workspaces').select('minutes_used,minutes_limit,plan')
          .eq('id', workspaceId).single(),
      ]);
      const totalSec = (callsRes.data ?? []).reduce((s, c) => s + (Number(c.duration_seconds) || 0), 0);
      return JSON.stringify({
        period_days: days,
        total_calls: callsRes.count ?? 0,
        total_agents: agentsRes.count ?? 0,
        total_duration_minutes: Math.round(totalSec / 60),
        minutes_used: wsRes.data?.minutes_used ?? 0,
        minutes_limit: wsRes.data?.minutes_limit ?? 0,
        plan: wsRes.data?.plan ?? 'free',
      });
    }

    case 'get_campaign_metrics': {
      let q = admin.from('campaigns')
        .select('id,name,status,total_contacts,completed_contacts')
        .eq('workspace_id', workspaceId);
      if (args['campaign_id']) q = q.eq('id', String(args['campaign_id']));
      const { data } = await q;
      return JSON.stringify(data ?? []);
    }

    case 'get_call_durations': {
      let q = admin.from('calls').select('duration_seconds')
        .eq('workspace_id', workspaceId).gte('created_at', since)
        .not('duration_seconds', 'is', null);
      if (args['agent_id']) q = q.eq('agent_id', String(args['agent_id']));
      const { data } = await q;
      const durations = (data ?? []).map((c) => Number(c.duration_seconds)).sort((a, b) => a - b);
      const p = (arr: number[], pct: number) => arr[Math.floor(arr.length * pct)] ?? 0;
      return JSON.stringify({
        count:       durations.length,
        avg_seconds: durations.length
          ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
          : 0,
        p50_seconds: p(durations, 0.5),
        p95_seconds: p(durations, 0.95),
      });
    }

    case 'get_success_rates': {
      let q = admin.from('calls').select('task_completed,sentiment')
        .eq('workspace_id', workspaceId).gte('created_at', since);
      if (args['agent_id']) q = q.eq('agent_id', String(args['agent_id']));
      const { data } = await q;
      const calls   = data ?? [];
      const total   = calls.length;
      const done    = calls.filter((c) => c.task_completed).length;
      return JSON.stringify({
        total,
        task_completed_pct: total ? Math.round((done / total) * 100) : 0,
        sentiment: {
          positive: calls.filter((c) => c.sentiment === 'positive').length,
          neutral:  calls.filter((c) => c.sentiment === 'neutral').length,
          negative: calls.filter((c) => c.sentiment === 'negative').length,
        },
      });
    }

    case 'get_top_agents': {
      const limit  = Number(args['limit'] ?? 5);
      const { data } = await admin.from('agents')
        .select('id,name,total_calls')
        .eq('workspace_id', workspaceId)
        .order('total_calls', { ascending: false })
        .limit(limit);
      return JSON.stringify(data ?? []);
    }

    default:
      return JSON.stringify({ error: 'Unknown tool' });
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env['ANTHROPIC_API_KEY']) {
    return NextResponse.json({ error: 'AI assistant not configured' }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: ws } = await admin.from('workspaces')
    .select('id').eq('owner_id', user.id).single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  const workspaceId = (ws as { id: string }).id;

  const { messages } = await req.json() as { messages: { role: 'user' | 'assistant'; content: string }[] };

  const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });

  const systemPrompt = `You are an analytics copilot for VoiceOS, a voice-AI SaaS platform.
Help workspace owners understand their call performance with concise answers and real numbers.
Always call the appropriate tool before answering — never guess metrics.
Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;

  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Agentic loop — up to 4 tool-calling rounds
  for (let round = 0; round < 4; round++) {
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   anthropicMessages,
      tools:      TOOLS,
    });

    anthropicMessages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      const textBlock = response.content.find((b) => b.type === 'text');
      const text = textBlock && 'text' in textBlock ? textBlock.text : '';
      return NextResponse.json({ reply: text });
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      response.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
        .map(async (b) => ({
          type:        'tool_result' as const,
          tool_use_id: b.id,
          content:     await executeTool(b.name, b.input as ToolInput, workspaceId),
        }))
    );

    anthropicMessages.push({ role: 'user', content: toolResults });
  }

  return NextResponse.json({ reply: 'Unable to retrieve data at this time. Please try again.' });
}
