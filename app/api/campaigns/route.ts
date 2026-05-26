import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, apiOk, parseBody } from '@/lib/api';

const CreateCampaignSchema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  agent_id: z.string().uuid().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  start_at: z.string().datetime().optional().nullable(),
  end_at: z.string().datetime().optional().nullable(),
  timezone: z.string().optional(),
  max_concurrency: z.number().int().min(1).max(100).optional(),
  retry_enabled: z.boolean().optional(),
  retry_interval_hours: z.number().int().min(1).optional(),
  respect_schedule: z.boolean().optional(),
});

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');

  let query = supabase
    .from('campaigns')
    .select('*, agent:agents(name, voice_engine)')
    .order('created_at', { ascending: false });

  if (workspaceId) query = query.eq('workspace_id', workspaceId);

  const { data, error } = await query;
  if (error) {
    console.error('[campaigns] GET error:', error);
    return apiError('Internal server error', 500);
  }
  return apiOk(data);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = parseBody(CreateCampaignSchema, await req.json());
  if (!parsed.success) return parsed.response;
  const body = parsed.data;
  const admin = createAdminClient();

  const { data, error } = await admin.from('campaigns').insert({
    workspace_id: body.workspace_id,
    agent_id: body.agent_id ?? null,
    name: body.name,
    description: body.description ?? null,
    status: 'draft',
    start_at: body.start_at ?? null,
    end_at: body.end_at ?? null,
    timezone: body.timezone ?? 'America/New_York',
    max_concurrency: body.max_concurrency ?? 5,
    retry_enabled: body.retry_enabled ?? true,
    retry_interval_hours: body.retry_interval_hours ?? 24,
    respect_schedule: body.respect_schedule ?? true
  }).select().single();

  if (error) {
    console.error('[campaigns] POST insert error:', error);
    return apiError('Internal server error', 500);
  }
  return apiOk(data, 201);
}
