import { createClient } from '@/lib/supabase/server';
import { retell } from '@/lib/retell/client';
import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const apiKey = process.env['RETELL_API_KEY'];
  if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const supabase = await createClient();
  const { data: agent } = await supabase
    .from('agents')
    .select('retell_agent_id')
    .eq('id', id)
    .single();

  if (!agent?.retell_agent_id) {
    return NextResponse.json({ error: 'Agent not configured for calls' }, { status: 400 });
  }

  try {
    const webCall = await retell.createWebCall(agent.retell_agent_id);
    return NextResponse.json({ access_token: webCall.access_token, call_id: webCall.call_id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
