import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { persona } = await req.json() as { persona?: string };

  const { data: agent } = await supabase.from('agents').select('*').eq('id', id).single();
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const a = agent as Record<string, unknown>;

  // Simulated conversation using Claude
  const ANTHROPIC_KEY = process.env['ANTHROPIC_API_KEY'];
  if (!ANTHROPIC_KEY) {
    return NextResponse.json({
      transcript: [
        { role: 'agent', text: a['first_message'] as string ?? 'Hello, how can I help you?' },
        { role: 'prospect', text: persona ?? 'Tell me more about your service.' },
        { role: 'agent', text: 'Great question! ' + (a['objective'] as string ?? '') }
      ]
    });
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: `You are simulating a sales call conversation. The AI agent has this system prompt: "${a['system_prompt'] ?? ''}". First message: "${a['first_message'] ?? ''}". Generate a realistic 6-turn conversation between agent and prospect. Prospect persona: ${persona ?? 'interested but skeptical business owner'}. Return JSON array: [{role:"agent"|"prospect", text:string}]`,
        messages: [{ role: 'user', content: 'Generate the simulation.' }]
      })
    });
    const data = await resp.json() as { content: { text: string }[] };
    let transcript: unknown[] = [];
    try {
      transcript = JSON.parse(data.content[0]?.text ?? '[]') as unknown[];
    } catch {
      // Claude returned non-JSON — return the raw text as a single agent turn
      transcript = [{ role: 'agent', text: data.content[0]?.text ?? '' }];
    }
    return NextResponse.json({ transcript });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
