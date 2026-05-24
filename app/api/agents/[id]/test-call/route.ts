import { createClient } from '@/lib/supabase/server';
import { retell } from '@/lib/retell/client';
import { NextResponse } from 'next/server';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: agent } = await supabase
    .from('agents')
    .select('retell_agent_id')
    .eq('id', id)
    .single();

  const retellAgentId = (agent as { retell_agent_id: string | null } | null)?.retell_agent_id;
  if (!retellAgentId) {
    return NextResponse.json({ error: 'Agent not synced to Retell yet' }, { status: 400 });
  }

  try {
    const call = await retell.createWebCall(retellAgentId);
    return NextResponse.json({ access_token: call.access_token, call_id: call.call_id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
