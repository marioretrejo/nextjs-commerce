/**
 * QA Center — Integrations API
 * Get or update the workspace's QA Center webhook configuration.
 * Auto-creates the integration record on first GET if it doesn't exist.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

async function resolveWorkspace(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from('workspaces').select('id').eq('owner_id', userId).single();
  return (data as { id: string } | null);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ws = await resolveWorkspace(user.id);
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const admin = createAdminClient();

  const COLS = 'id, webhook_token, twilio_account_sid, auto_analyze, agent_name_field, is_active, field_mappings, provider_name, created_at';

  let { data } = await admin
    .from('qac_integrations')
    .select(COLS)
    .eq('workspace_id', ws.id)
    .single();

  // Auto-create on first request
  if (!data) {
    const { data: created } = await admin
      .from('qac_integrations')
      .insert({ workspace_id: ws.id })
      .select(COLS)
      .single();
    data = created;
  }

  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ws = await resolveWorkspace(user.id);
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const body = await req.json() as Record<string, unknown>;
  const update: Record<string, unknown> = {};

  if ('twilio_account_sid'  in body) update.twilio_account_sid = body.twilio_account_sid || null;
  if ('twilio_auth_token'   in body) update.twilio_auth_token  = body.twilio_auth_token  || null;
  if ('auto_analyze'        in body && typeof body.auto_analyze   === 'boolean') update.auto_analyze   = body.auto_analyze;
  if ('agent_name_field'    in body && typeof body.agent_name_field === 'string') update.agent_name_field = body.agent_name_field;
  if ('is_active'           in body && typeof body.is_active       === 'boolean') update.is_active       = body.is_active;
  if ('provider_name'       in body && typeof body.provider_name   === 'string') update.provider_name   = body.provider_name || null;
  if ('field_mappings'      in body && typeof body.field_mappings  === 'object' && body.field_mappings !== null) {
    update.field_mappings = body.field_mappings;
  }

  const admin = createAdminClient();

  // Upsert in case record doesn't exist yet
  const { data, error } = await admin
    .from('qac_integrations')
    .upsert({ workspace_id: ws.id, ...update }, { onConflict: 'workspace_id' })
    .select('id, webhook_token, twilio_account_sid, auto_analyze, agent_name_field, is_active, field_mappings, provider_name')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
