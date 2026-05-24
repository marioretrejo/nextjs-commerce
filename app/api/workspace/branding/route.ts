import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('workspaces')
    .select('id, name, branding')
    .eq('owner_id', user.id)
    .single();

  return NextResponse.json(data ?? { branding: null });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, plan')
    .eq('owner_id', user.id)
    .single();

  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const body = await req.json() as { name?: string; branding?: Record<string, unknown> };

  const admin = createAdminClient();
  const updateData: Record<string, unknown> = {};
  if (body.name) updateData.name = body.name;
  if (body.branding) updateData.branding = body.branding;

  const { data, error } = await admin
    .from('workspaces')
    .update(updateData)
    .eq('id', ws.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
