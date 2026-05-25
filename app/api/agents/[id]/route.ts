import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { retell } from '@/lib/retell/client';
import { sanitizeAgentForClient } from '@/lib/sanitize';
import type { Agent } from '@/lib/supabase/types';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // RLS on the user client ensures only owned agents are returned
  const { data, error } = await supabase.from('agents').select('*').eq('id', id).single();
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(sanitizeAgentForClient(data as Record<string, unknown>));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify ownership via RLS before using admin client for the write
  const { data: existing } = await supabase.from('agents').select('id').eq('id', id).single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as Partial<Agent>;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('agents')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const agent = data as Agent;

  // Sync to Retell
  if (agent.retell_agent_id && process.env['RETELL_API_KEY']) {
    try {
      await retell.updateAgent(agent.retell_agent_id, {
        agent_name: agent.name,
        voice_id: agent.voice_id ?? undefined,
        language: agent.language as 'en-US',
        interruption_sensitivity: agent.interruption_handling ? 0.8 : 0.1
      });
    } catch (e) {
      console.error('Retell sync failed:', e);
    }
  }

  return NextResponse.json(sanitizeAgentForClient(agent as unknown as Record<string, unknown>));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify ownership via RLS — also fetch retell_agent_id while we're at it
  const { data: agent } = await supabase.from('agents').select('retell_agent_id').eq('id', id).single();
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if ((agent as { retell_agent_id: string | null }).retell_agent_id && process.env['RETELL_API_KEY']) {
    try {
      await retell.deleteAgent((agent as { retell_agent_id: string }).retell_agent_id);
    } catch (e) {
      console.error('Retell delete failed:', e);
    }
  }

  const admin = createAdminClient();
  const { error } = await admin.from('agents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
