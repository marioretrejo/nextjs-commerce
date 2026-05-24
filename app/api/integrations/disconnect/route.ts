import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { type: string };
  const { type } = body;
  if (!type) return NextResponse.json({ error: 'type required' }, { status: 400 });

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const admin = createAdminClient();
  await admin.from('integrations')
    .update({ status: 'disconnected', credentials: {} })
    .eq('workspace_id', ws.id)
    .eq('type', type);

  return NextResponse.json({ ok: true });
}
