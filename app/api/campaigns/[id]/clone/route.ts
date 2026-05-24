import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: original } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (!original) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { name?: string };

  const admin = createAdminClient();
  const { data, error } = await admin.from('campaigns').insert({
    workspace_id: original.workspace_id,
    agent_id: original.agent_id,
    name: body.name ?? `${original.name} (Copy)`,
    description: original.description,
    status: 'draft',
    timezone: original.timezone,
    max_concurrency: original.max_concurrency,
    retry_enabled: original.retry_enabled,
    retry_interval_hours: original.retry_interval_hours,
    respect_schedule: original.respect_schedule,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
