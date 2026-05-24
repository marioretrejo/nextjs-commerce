import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get user's workspace
  const { data: ws } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  const workspaceId = ws?.id;
  if (!workspaceId) return NextResponse.json({ calls: [] });

  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('calls')
    .select('*, agent:agents(name)')
    .eq('workspace_id', workspaceId)
    .eq('status', 'in_progress')
    .gte('created_at', fourHoursAgo)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ calls: data ?? [] });
}
