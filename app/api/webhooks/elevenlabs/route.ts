import { createAdminClient } from '@/lib/supabase/admin';
import { updateWorkspaceMinutes } from '@/lib/updateWorkspaceMinutes';
import { NextResponse } from 'next/server';

interface ElevenLabsCallEvent {
  event_type?: string;
  call_id?: string;
  agent_id?: string;
  duration_secs?: number;
  metadata?: Record<string, unknown>;
}

export async function POST(req: Request) {
  const body = await req.json() as ElevenLabsCallEvent;

  if (body.event_type === 'call_ended' && body.agent_id && body.duration_secs) {
    const admin = createAdminClient();

    const { data: agent } = await admin
      .from('agents')
      .select('id, workspace_id')
      .eq('elevenlabs_agent_id', body.agent_id)
      .maybeSingle();

    if (agent) {
      const agentRow = agent as { id: string; workspace_id: string };
      await updateWorkspaceMinutes(agentRow.workspace_id, body.duration_secs);
    }
  }

  return NextResponse.json({ received: true });
}
