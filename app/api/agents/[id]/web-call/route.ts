import { createClient } from '@/lib/supabase/server';
import { retell } from '@/lib/retell/client';
import { checkMinuteLimit, minuteLimitBlockedResponse } from '@/lib/checkMinuteLimit';
import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  void req;

  const apiKey = process.env['RETELL_API_KEY'];
  if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: agent } = await supabase
    .from('agents')
    .select('retell_agent_id, workspace_id')
    .eq('id', id)
    .single();

  // Minute limit enforcement gate
  const workspaceId = (agent as { workspace_id?: string } | null)?.workspace_id;
  if (workspaceId) {
    const limit = await checkMinuteLimit(workspaceId);
    if (!limit.allowed) return NextResponse.json(minuteLimitBlockedResponse(limit), { status: 402 });
  }

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
