import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// Internal-only endpoint — called by the Retell webhook (server-to-server).
// Secured by requiring a shared internal secret token.
export async function POST(req: Request) {
  const internalToken = req.headers.get('x-internal-token');
  const expectedToken = process.env['INTERNAL_API_SECRET'];

  // Allow calls from within the same process (no token) only in development,
  // or when token matches. In production, always require the token.
  if (expectedToken && internalToken !== expectedToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { retell_call_id, agent_id } = await req.json() as {
    retell_call_id: string;
    agent_id: string;
    workspace_id: string;
  };

  const admin = createAdminClient();

  const [{ data: callData }, { data: criteria }] = await Promise.all([
    admin.from('calls').select('transcript, id').eq('retell_call_id', retell_call_id).single(),
    admin.from('qa_criteria').select('*').eq('agent_id', agent_id)
  ]);

  const call = callData as { transcript: string | null; id: string } | null;
  if (!call?.transcript || !criteria?.length) return NextResponse.json({ ok: true });

  const ANTHROPIC_KEY = process.env['ANTHROPIC_API_KEY'];
  if (!ANTHROPIC_KEY) return NextResponse.json({ ok: true });

  try {
    const criteriaList = (criteria as { name: string; description: string | null; weight: number }[])
      .map((c) => `- ${c.name} (weight ${c.weight}/10): ${c.description ?? ''}`)
      .join('\n');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: 'You are a call quality analyst. Score the call transcript against the criteria. Return only valid JSON: {"overall": number 0-100, "scores": [{"name": string, "score": number 0-100}]}',
        messages: [{
          role: 'user',
          content: `Criteria:\n${criteriaList}\n\nTranscript:\n${call.transcript.slice(0, 4000)}\n\nScore this call.`
        }]
      })
    });

    const data = await res.json() as { content: { text: string }[] };
    let result: { overall?: number } = {};
    try {
      result = JSON.parse(data.content[0]?.text ?? '{}') as { overall?: number };
    } catch {
      console.error('QA: failed to parse Claude response');
    }

    if (typeof result.overall === 'number') {
      await admin.from('calls').update({ qa_score: result.overall }).eq('id', call.id);
    }
  } catch (e) {
    console.error('QA scoring failed:', e);
  }

  return NextResponse.json({ ok: true });
}
