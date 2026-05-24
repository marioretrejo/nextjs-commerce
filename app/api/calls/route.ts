import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  const agentId = searchParams.get('agent_id');
  const campaignId = searchParams.get('campaign_id');
  const outcome = searchParams.get('outcome');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const since = searchParams.get('since');
  const page = Number(searchParams.get('page') ?? 1);
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 1000);
  const offset = (page - 1) * limit;

  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  let query = supabase
    .from('calls')
    .select('*, agent:agents(name)', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (agentId) query = query.eq('agent_id', agentId);
  if (campaignId) query = query.eq('campaign_id', campaignId);
  if (outcome) query = query.eq('outcome', outcome);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  if (since) query = query.gte('created_at', since);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, total: count, page, limit });
}
