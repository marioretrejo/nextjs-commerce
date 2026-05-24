import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { retell } from '@/lib/retell/client';
import type { Agent, Campaign, CampaignContact } from '@/lib/supabase/types';
import { NextResponse } from 'next/server';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', id).single();
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const c = campaign as Campaign;

  // Check minutes limit
  const { data: ws } = await supabase.from('workspaces').select('minutes_used, minutes_limit').eq('id', c.workspace_id).single();
  const workspace = ws as { minutes_used: number; minutes_limit: number } | null;
  if (workspace && workspace.minutes_used >= workspace.minutes_limit) {
    return NextResponse.json({ error: 'Minutes limit reached' }, { status: 403 });
  }

  // Get agent
  const { data: agentData } = await supabase.from('agents').select('*').eq('id', c.agent_id ?? '').single();
  if (!agentData) return NextResponse.json({ error: 'Agent not found' }, { status: 400 });
  const agent = agentData as Agent;

  // Get pending contacts
  const { data: contacts } = await supabase
    .from('campaign_contacts')
    .select('*')
    .eq('campaign_id', id)
    .eq('status', 'pending')
    .limit(1000);

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ error: 'No pending contacts' }, { status: 400 });
  }

  const fromNumber = process.env['TWILIO_PHONE_NUMBER'];
  if (!fromNumber) return NextResponse.json({ error: 'No Twilio number configured' }, { status: 500 });

  const admin = createAdminClient();

  // Launch batch via Retell
  if (agent.retell_agent_id && process.env['RETELL_API_KEY']) {
    try {
      const tasks = (contacts as CampaignContact[]).map((contact) => ({
        from_number: fromNumber,
        to_number: contact.phone,
        override_agent_id: agent.retell_agent_id!,
        metadata: {
          campaign_id: id,
          contact_id: contact.id,
          contact_name: contact.name,
          to_number: contact.phone
        },
        retell_llm_dynamic_variables: contact.variables as Record<string, string>
      }));

      const batch = await retell.batchCall({
        from_number: fromNumber,
        tasks,
        name: c.name,
        max_concurrent_calls: c.max_concurrency
      });

      await admin.from('campaigns').update({
        status: 'active',
        retell_batch_call_id: batch.batch_call_id
      }).eq('id', id);

      return NextResponse.json({ batch_call_id: batch.batch_call_id, contacts: contacts.length });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // Fallback: mark as active
  await admin.from('campaigns').update({ status: 'active' }).eq('id', id);
  return NextResponse.json({ ok: true, contacts: contacts.length });
}
