import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { retell } from '@/lib/retell/client';
import { sanitizeAgentForClient } from '@/lib/sanitize';
import type { Agent } from '@/lib/supabase/types';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/** Verify the authenticated user owns the workspace that contains this agent.
 *  Uses admin client to bypass RLS (mirrors the edit-page's admin fallback),
 *  then checks workspace ownership via the user-scoped client. */
async function verifyOwnership(
  agentId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ agentRow: Record<string, unknown> } | { error: NextResponse }> {
  const { data: agentRow } = await admin
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();
  if (!agentRow) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  const { data: ws } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', (await supabase.auth.getUser()).data.user!.id)
    .eq('id', (agentRow as Record<string, unknown>)['workspace_id'] as string)
    .single();
  if (!ws) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return { agentRow: agentRow as Record<string, unknown> };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const result = await verifyOwnership(id, supabase, admin);
  if ('error' in result) return result.error;
  return NextResponse.json(sanitizeAgentForClient(result.agentRow));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const ownership = await verifyOwnership(id, supabase, admin);
  if ('error' in ownership) return ownership.error;

  const body = await req.json() as Partial<Agent>;

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
      let voicemailOption: { action: { type: 'hangup' } | { type: 'static_text'; text: string } } | null = null;
      if (agent.amd_enabled) {
        if (agent.amd_action === 'hangup') {
          voicemailOption = { action: { type: 'hangup' } };
        } else if (agent.amd_action === 'leave_voicemail') {
          const msg = agent.voicemail_message?.trim() || 'Thank you for your time. We\'ll try reaching you again soon.';
          voicemailOption = { action: { type: 'static_text', text: msg } };
        }
      }
      await retell.updateAgent(agent.retell_agent_id, {
        agent_name: agent.name,
        voice_id: agent.voice_id ?? undefined,
        language: agent.language as 'en-US',
        interruption_sensitivity: agent.interruption_handling ? 0.8 : 0.1,
        voicemail_option: voicemailOption,
        ambient_sound: agent.ambient_sound ?? null,
        ambient_sound_volume: agent.ambient_sound != null ? (agent.ambient_sound_volume ?? 1.0) : undefined,
        voice_emotion: agent.voice_emotion ?? null,
      });
    } catch (e) {
      console.error('Retell sync failed:', e);
    }
  }

  revalidatePath('/agents');
  revalidatePath(`/agents/${id}`);
  return NextResponse.json(sanitizeAgentForClient(agent as unknown as Record<string, unknown>));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const ownership = await verifyOwnership(id, supabase, admin);
  if ('error' in ownership) return ownership.error;

  const retellAgentId = (ownership.agentRow['retell_agent_id'] as string | null) ?? null;
  if (retellAgentId && process.env['RETELL_API_KEY']) {
    try {
      await retell.deleteAgent(retellAgentId);
    } catch (e) {
      console.error('Retell delete failed:', e);
    }
  }

  const { error } = await admin.from('agents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
