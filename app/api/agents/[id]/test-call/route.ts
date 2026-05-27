import { createClient } from '@/lib/supabase/server';
import { retell } from '@/lib/retell/client';
import { syncAgentToRetell } from '@/lib/retell/sync';
import { checkMinuteLimit, minuteLimitBlockedResponse } from '@/lib/checkMinuteLimit';
import { NextResponse } from 'next/server';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  let retellAgentId = (agent as { retell_agent_id: string | null } | null)?.retell_agent_id;

  // Auto-sync if not yet connected to Retell
  if (!retellAgentId) {
    try {
      retellAgentId = await syncAgentToRetell(id);
    } catch (e) {
      console.error('Auto-sync failed:', e);
    }
    if (!retellAgentId) {
      return NextResponse.json({ error: 'Failed to sync agent to Retell. Check RETELL_API_KEY.' }, { status: 500 });
    }
  }

  try {
    const call = await retell.createWebCall(retellAgentId);
    return NextResponse.json({ access_token: call.access_token, call_id: call.call_id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
