import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { retell } from '@/lib/retell/client';
import type { Agent } from '@/lib/supabase/types';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.from('agents').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  return NextResponse.json(agent);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: agent } = await supabase.from('agents').select('retell_agent_id').eq('id', id).single();

  if (agent && (agent as { retell_agent_id: string | null }).retell_agent_id && process.env['RETELL_API_KEY']) {
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
