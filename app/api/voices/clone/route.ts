/**
 * POST /api/voices/clone
 *
 * Clones a voice using Cartesia Voice Cloning, then saves the resulting
 * voice_id to our `custom_voices` table with provider = 'cartesia'.
 *
 * FormData fields:
 *   name        string   — display name
 *   language    string?  — ISO 639-1 code (default 'en')
 *   gender      string?  — 'male' | 'female' | 'neutral'
 *   mode        string?  — 'similarity' (default) | 'reconstruction'
 *   file        File     — audio clip (.mp3 / .wav / .m4a, ≥10s, ≤25 MB)
 *
 * GET  → list workspace custom voices
 * DELETE { id } → remove from Cartesia + DB
 */
import { cloneCartesiaVoice, deleteCartesiaVoice } from '@/lib/cartesia';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

async function resolveWorkspaceId(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from('workspaces').select('id').eq('owner_id', userId).single();
  return (data as { id: string } | null)?.id ?? null;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = await resolveWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const formData = await req.formData();
  const name     = formData.get('name')     as string | null;
  const language = (formData.get('language') as string | null) ?? 'en';
  const gender   = (formData.get('gender')   as string | null) ?? null;
  const mode     = ((formData.get('mode')    as string | null) ?? 'similarity') as 'similarity' | 'reconstruction';
  const file     = formData.get('file')     as File | null;

  if (!name?.trim() || !file) {
    return NextResponse.json({ error: 'name and file are required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Insert a 'cloning' placeholder so the UI shows progress immediately
  const { data: voiceRow, error: insertErr } = await admin
    .from('custom_voices')
    .insert({
      workspace_id:      workspaceId,
      name:              name.trim(),
      provider:          'cartesia',
      provider_voice_id: 'pending',
      language,
      gender:            gender ?? null,
      status:            'cloning',
    })
    .select()
    .single();

  if (insertErr || !voiceRow) {
    return NextResponse.json({ error: insertErr?.message ?? 'DB insert error' }, { status: 500 });
  }

  const rowId = (voiceRow as { id: string }).id;

  try {
    const result = await cloneCartesiaVoice({ name: name.trim(), language, mode, file });

    await admin
      .from('custom_voices')
      .update({ provider_voice_id: result.id, status: 'ready' })
      .eq('id', rowId);

    return NextResponse.json({
      id:                rowId,
      provider_voice_id: result.id,
      status:            'ready',
    }, { status: 201 });

  } catch (e) {
    await admin
      .from('custom_voices')
      .update({ status: 'error', error_message: String(e) })
      .eq('id', rowId);

    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = await resolveWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json([]);

  const admin = createAdminClient();
  const { data } = await admin
    .from('custom_voices')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  return NextResponse.json(data ?? []);
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const admin = createAdminClient();
  const { data: voice } = await admin.from('custom_voices').select('provider_voice_id, status').eq('id', id).single();

  if (voice) {
    const v = voice as { provider_voice_id: string; status: string };
    if (v.provider_voice_id !== 'pending' && v.status === 'ready') {
      try { await deleteCartesiaVoice(v.provider_voice_id); } catch { /* non-fatal */ }
    }
  }

  const { error } = await admin.from('custom_voices').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
