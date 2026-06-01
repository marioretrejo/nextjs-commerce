import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { writeAuditLog } from '@/lib/admin-audit';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify campaign ownership via RLS before using admin client
  const { data: campaign } = await supabase.from('campaigns').select('id, name, workspace_id').eq('id', id).single();
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const c = campaign as { id: string; name: string; workspace_id: string };
  const admin = createAdminClient();
  const { error } = await admin.from('campaigns').update({ status: 'paused' }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void writeAuditLog({
    actorId: user.id, actorType: 'user', action: 'campaign.pause',
    targetType: 'campaign', targetId: id,
    workspaceId: c.workspace_id,
    metadata: { campaign_name: c.name },
  });

  return NextResponse.json({ ok: true });
}
