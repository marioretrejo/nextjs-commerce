import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat';

const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_workspace_stats',
      description: 'Get overall workspace stats: total calls, minutes used/limit, plan, active agents count.',
      parameters: { type: 'object' as const, properties: { period_days: { type: 'number', description: 'Days to look back (default 30)' } }, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_campaign_metrics',
      description: 'Get campaign performance: call volume, completion rate, status breakdown.',
      parameters: { type: 'object' as const, properties: { campaign_id: { type: 'string' }, period_days: { type: 'number' } }, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_call_durations',
      description: 'Get call duration statistics: avg, p50, p95 in seconds.',
      parameters: { type: 'object' as const, properties: { agent_id: { type: 'string' }, period_days: { type: 'number' } }, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_success_rates',
      description: 'Get task-completion % and sentiment breakdown (positive/neutral/negative).',
      parameters: { type: 'object' as const, properties: { agent_id: { type: 'string' }, period_days: { type: 'number' } }, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_agents',
      description: 'List top-performing agents ranked by call volume or success rate.',
      parameters: { type: 'object' as const, properties: { limit: { type: 'number' }, rank_by: { type: 'string', enum: ['call_volume', 'success_rate'] } }, required: [] },
    },
  },
];

async function executeTool(name: string, args: Record<string, unknown>, workspaceId: string): Promise<string> {
  const admin = createAdminClient();
  const days  = Number(args['period_days'] ?? 30);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  switch (name) {
    case 'get_workspace_stats': {
      const [callsRes, agentsRes, wsRes] = await Promise.all([
        admin.from('calls').select('duration_seconds', { count: 'exact' }).eq('workspace_id', workspaceId).gte('created_at', since),
        admin.from('agents').select('id', { count: 'exact' }).eq('workspace_id', workspaceId),
        admin.from('workspaces').select('minutes_used,minutes_limit,plan').eq('id', workspaceId).single(),
      ]);
      const totalSec = (callsRes.data ?? []).reduce((s, c) => s + (Number(c.duration_seconds) || 0), 0);
      return JSON.stringify({ period_days: days, total_calls: callsRes.count ?? 0, total_agents: agentsRes.count ?? 0, total_duration_minutes: Math.round(totalSec / 60), minutes_used: wsRes.data?.minutes_used ?? 0, minutes_limit: wsRes.data?.minutes_limit ?? 0, plan: wsRes.data?.plan ?? 'free' });
    }
    case 'get_campaign_metrics': {
      let q = admin.from('campaigns').select('id,name,status,total_contacts,completed_contacts').eq('workspace_id', workspaceId);
      if (args['campaign_id']) q = q.eq('id', String(args['campaign_id']));
      const { data } = await q;
      return JSON.stringify(data ?? []);
    }
    case 'get_call_durations': {
      let q = admin.from('calls').select('duration_seconds').eq('workspace_id', workspaceId).gte('created_at', since).not('duration_seconds', 'is', null);
      if (args['agent_id']) q = q.eq('agent_id', String(args['agent_id']));
      const { data } = await q;
      const durations = (data ?? []).map((c) => Number(c.duration_seconds)).sort((a, b) => a - b);
      const p = (arr: number[], pct: number) => arr[Math.floor(arr.length * pct)] ?? 0;
      return JSON.stringify({ count: durations.length, avg_seconds: durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : 0, p50_seconds: p(durations, 0.5), p95_seconds: p(durations, 0.95) });
    }
    case 'get_success_rates': {
      let q = admin.from('calls').select('task_completed,sentiment').eq('workspace_id', workspaceId).gte('created_at', since);
      if (args['agent_id']) q = q.eq('agent_id', String(args['agent_id']));
      const { data } = await q;
      const calls = data ?? [];
      const total = calls.length;
      const done  = calls.filter((c) => c.task_completed).length;
      return JSON.stringify({ total, task_completed_pct: total ? Math.round((done / total) * 100) : 0, sentiment: { positive: calls.filter((c) => c.sentiment === 'positive').length, neutral: calls.filter((c) => c.sentiment === 'neutral').length, negative: calls.filter((c) => c.sentiment === 'negative').length } });
    }
    case 'get_top_agents': {
      const { data } = await admin.from('agents').select('id,name,total_calls').eq('workspace_id', workspaceId).order('total_calls', { ascending: false }).limit(Number(args['limit'] ?? 5));
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

  if (!process.env['OPENAI_API_KEY']) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: ws } = await admin.from('workspaces').select('id').eq('owner_id', user.id).single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  const workspaceId = (ws as { id: string }).id;

  const { messages } = await req.json() as { messages: ChatCompletionMessageParam[] };
  const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

  const history: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are an analytics copilot for VoiceOS, a voice-AI SaaS platform. Help workspace owners understand their call performance with concise answers and real numbers. Always call the appropriate tool before answering — never guess metrics. Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`,
    },
    ...messages,
  ];

  for (let round = 0; round < 4; round++) {
    const response = await openai.chat.completions.create({ model: 'gpt-4o', messages: history, tools: TOOLS, tool_choice: 'auto', max_tokens: 1024 });
    const choice = response.choices[0];
    if (!choice) break;
    history.push(choice.message);

    if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) {
      return NextResponse.json({ reply: choice.message.content ?? '' });
    }

    const fnCalls = choice.message.tool_calls.filter(
      (tc): tc is typeof tc & { function: { name: string; arguments: string } } => 'function' in tc && tc.type === 'function'
    );

    const results = await Promise.all(
      fnCalls.map(async (tc) => ({
        role: 'tool' as const,
        tool_call_id: tc.id,
        content: await executeTool(tc.function.name, JSON.parse(tc.function.arguments) as Record<string, unknown>, workspaceId),
      }))
    );
    history.push(...results);
  }

  return NextResponse.json({ reply: 'Unable to retrieve data at this time. Please try again.' });
}
