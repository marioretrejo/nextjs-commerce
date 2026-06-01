import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'groq-sdk/resources/chat/completions';

const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_workspace_stats',
      description: 'Get overall workspace stats: total calls, minutes used/limit, plan, active agents count.',
      parameters: {
        type: 'object' as const,
        properties: {
          period_days: { type: 'string', description: 'Days to look back, e.g. "30". Default 30.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_campaign_metrics',
      description: 'Get campaign performance: call volume, completion rate, status breakdown.',
      parameters: {
        type: 'object' as const,
        properties: {
          campaign_id: { type: 'string', description: 'Optional specific campaign ID, or omit for all.' },
          period_days: { type: 'string', description: 'Days to look back, e.g. "30". Default 30.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_call_durations',
      description: 'Get call duration statistics: avg, p50, p95 in seconds.',
      parameters: {
        type: 'object' as const,
        properties: {
          agent_id:   { type: 'string', description: 'Optional agent ID filter.' },
          period_days: { type: 'string', description: 'Days to look back, e.g. "30". Default 30.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_success_rates',
      description: 'Get task-completion % and sentiment breakdown (positive/neutral/negative).',
      parameters: {
        type: 'object' as const,
        properties: {
          agent_id:   { type: 'string', description: 'Optional agent ID filter.' },
          period_days: { type: 'string', description: 'Days to look back, e.g. "30". Default 30.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_agents',
      description: 'List top-performing agents ranked by call volume or success rate.',
      parameters: {
        type: 'object' as const,
        properties: {
          limit:   { type: 'string', description: 'Number of agents to return, e.g. "5". Default 5.' },
          rank_by: { type: 'string', enum: ['call_volume', 'success_rate'] },
        },
        required: [],
      },
    },
  },
];

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  workspaceId: string,
): Promise<string> {
  const admin = createAdminClient();
  const days  = Number(args['period_days'] ?? 30) || 30;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  try {
    switch (name) {
      case 'get_workspace_stats': {
        const [callsRes, agentsRes, wsRes] = await Promise.all([
          admin.from('calls').select('duration_seconds', { count: 'exact' }).eq('workspace_id', workspaceId).gte('created_at', since),
          admin.from('agents').select('id', { count: 'exact' }).eq('workspace_id', workspaceId).eq('status', 'active'),
          admin.from('workspaces').select('minutes_used,minutes_limit,plan').eq('id', workspaceId).single(),
        ]);
        const totalSec = (callsRes.data ?? []).reduce((s, c) => s + (Number(c.duration_seconds) || 0), 0);
        return JSON.stringify({
          period_days: days,
          total_calls: callsRes.count ?? 0,
          active_agents: agentsRes.count ?? 0,
          total_duration_minutes: Math.round(totalSec / 60),
          minutes_used: wsRes.data?.minutes_used ?? 0,
          minutes_limit: wsRes.data?.minutes_limit ?? 0,
          plan: wsRes.data?.plan ?? 'free',
        });
      }

      case 'get_campaign_metrics': {
        let q = admin.from('campaigns')
          .select('id,name,status,total_contacts,completed_contacts,converted_contacts')
          .eq('workspace_id', workspaceId);
        if (args['campaign_id'] && args['campaign_id'] !== 'all') {
          q = q.eq('id', String(args['campaign_id']));
        }
        const { data } = await q;
        return JSON.stringify(data ?? []);
      }

      case 'get_call_durations': {
        let q = admin.from('calls').select('duration_seconds').eq('workspace_id', workspaceId).gte('created_at', since).not('duration_seconds', 'is', null);
        if (args['agent_id']) q = q.eq('agent_id', String(args['agent_id']));
        const { data } = await q;
        const durations = (data ?? []).map((c) => Number(c.duration_seconds)).sort((a, b) => a - b);
        const p = (arr: number[], pct: number) => arr[Math.floor(arr.length * pct)] ?? 0;
        return JSON.stringify({
          count: durations.length,
          avg_seconds: durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : 0,
          p50_seconds: p(durations, 0.5),
          p95_seconds: p(durations, 0.95),
        });
      }

      case 'get_success_rates': {
        let q = admin.from('calls').select('task_completed,sentiment').eq('workspace_id', workspaceId).gte('created_at', since);
        if (args['agent_id']) q = q.eq('agent_id', String(args['agent_id']));
        const { data } = await q;
        const calls = data ?? [];
        const total = calls.length;
        const done  = calls.filter((c) => c.task_completed).length;
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
        const { data } = await admin.from('agents')
          .select('id,name,total_calls,avg_qa_score')
          .eq('workspace_id', workspaceId)
          .order('total_calls', { ascending: false })
          .limit(Number(args['limit'] ?? 5) || 5);
        return JSON.stringify(data ?? []);
      }

      default:
        return JSON.stringify({ error: 'Unknown tool' });
    }
  } catch {
    return JSON.stringify({ error: 'Data temporarily unavailable' });
  }
}

interface CopilotConfig {
  system_prompt: string;
  rag_documents: { title: string; content: string }[];
  model: string;
  temperature: number;
  max_tokens: number;
  enabled: boolean;
}

const FALLBACK_SYSTEM_PROMPT = `You are a friendly analytics copilot for VoiceOS, a voice-AI platform. You help workspace owners understand their data.

Rules:
- Be conversational and friendly. Answer greetings, general questions, and small talk naturally WITHOUT calling any tool.
- Only call a tool when the user specifically asks about metrics, calls, campaigns, agents, or analytics data.
- When you get tool results, summarize them in clear, concise natural language. Format numbers nicely (e.g. "2 calls", "85% success rate").
- If asked about projections, use current data to extrapolate (e.g. "at this pace, ~X by end of month").
- Respond in the same language the user writes in (Spanish or English).`;

async function loadCopilotConfig(admin: ReturnType<typeof createAdminClient>): Promise<CopilotConfig> {
  try {
    const { data } = await admin.from('copilot_config').select('*').eq('id', 'global').single();
    if (data) return data as CopilotConfig;
  } catch { /* fall through */ }
  return {
    system_prompt: FALLBACK_SYSTEM_PROMPT,
    rag_documents: [],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    max_tokens: 1024,
    enabled: true,
  };
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const groqKey = process.env['GROQ_API_KEY'];
    if (!groqKey) {
      return NextResponse.json({ reply: 'El Analytics Copilot no está configurado. Agrega GROQ_API_KEY en las variables de entorno de Vercel.' });
    }

    const admin = createAdminClient();

    // Load workspace and copilot config in parallel
    const [wsResult, cfg] = await Promise.all([
      admin.from('workspaces').select('id').eq('owner_id', user.id).single(),
      loadCopilotConfig(admin),
    ]);

    if (!wsResult.data) return NextResponse.json({ reply: 'No se encontró tu workspace.' });
    const workspaceId = (wsResult.data as { id: string }).id;

    if (!cfg.enabled) {
      return NextResponse.json({ reply: 'El Analytics Copilot está deshabilitado por el administrador.' });
    }

    const { messages } = await req.json() as { messages: ChatCompletionMessageParam[] };
    const groq = new Groq({ apiKey: groqKey });

    // Build system prompt: use configured prompt (or fallback), then append RAG docs and date
    const basePrompt = cfg.system_prompt.trim() || FALLBACK_SYSTEM_PROMPT;
    const ragSection = cfg.rag_documents.length > 0
      ? '\n\n---\n## Knowledge Base\nUse the following documents to answer questions when relevant:\n\n' +
        cfg.rag_documents
          .map((doc) => `### ${doc.title}\n${doc.content}`)
          .join('\n\n')
      : '';
    const systemPrompt = `${basePrompt}${ragSection}\n\n- Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;

    const history: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // Agentic loop: up to 4 rounds of tool calls
    for (let round = 0; round < 4; round++) {
      let response;
      try {
        response = await groq.chat.completions.create({
          model:       cfg.model ?? 'llama-3.3-70b-versatile',
          messages:    history,
          tools:       TOOLS,
          tool_choice: 'auto',
          max_tokens:  cfg.max_tokens ?? 1024,
          temperature: cfg.temperature ?? 0.3,
        });
      } catch (groqErr) {
        // If tool validation fails, retry this round without tools
        const errStr = String(groqErr);
        if (errStr.includes('tool_validation_error') || errStr.includes('tool call validation')) {
          try {
            const fallback = await groq.chat.completions.create({
              model:       cfg.model ?? 'llama-3.3-70b-versatile',
              messages:    history,
              max_tokens:  cfg.max_tokens ?? 1024,
              temperature: cfg.temperature ?? 0.3,
            });
            const content = fallback.choices[0]?.message?.content;
            return NextResponse.json({ reply: content ?? 'No pude obtener los datos en este momento. Por favor intenta de nuevo.' });
          } catch {
            return NextResponse.json({ reply: 'Servicio temporalmente no disponible. Por favor intenta en unos segundos.' });
          }
        }
        throw groqErr;
      }

      const choice = response.choices[0];
      if (!choice) break;
      history.push(choice.message);

      // Model finished — return text response
      if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) {
        const content = choice.message.content;
        return NextResponse.json({ reply: content ?? 'No tengo datos disponibles para responder eso.' });
      }

      // Execute all tool calls in parallel
      const toolCalls = choice.message.tool_calls.filter(
        (tc): tc is typeof tc & { function: { name: string; arguments: string } } =>
          tc.type === 'function' && 'function' in tc,
      );

      const toolResults = await Promise.all(
        toolCalls.map(async (tc) => {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.function.arguments) as Record<string, unknown>; } catch { /* ignore */ }
          return {
            role: 'tool' as const,
            tool_call_id: tc.id,
            content: await executeTool(tc.function.name, args, workspaceId),
          };
        }),
      );

      history.push(...toolResults);
    }

    return NextResponse.json({ reply: 'No pude obtener una respuesta. Por favor intenta de nuevo.' });

  } catch (e) {
    console.error('[copilot] error:', e);
    return NextResponse.json({ reply: 'Ocurrió un error inesperado. Por favor intenta de nuevo en unos segundos.' });
  }
}
