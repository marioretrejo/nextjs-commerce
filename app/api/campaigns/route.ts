import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');

  const query = supabase.from('campaigns').select('*, agent:agents(name, voice_engine)').order('created_at', { ascending: false });
  if (workspaceId) query.eq('workspace_id', workspaceId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const admin = createAdminClient();

  const { data, error } = await admin.from('campaigns').insert({
    workspace_id: body['workspace_id'],
    agent_id: body['agent_id'] ?? null,
    name: body['name'],
    description: body['description'] ?? null,
    status: 'draft',
    start_at: body['start_at'] ?? null,
    end_at: body['end_at'] ?? null,
    timezone: body['timezone'] ?? 'America/New_York',
    max_concurrency: body['max_concurrency'] ?? 5,
    retry_enabled: body['retry_enabled'] ?? true,
    retry_interval_hours: body['retry_interval_hours'] ?? 24,
    respect_schedule: body['respect_schedule'] ?? true
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
