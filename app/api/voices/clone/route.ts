/**
 * POST /api/voices/clone
 *
 * Clones a voice using ElevenLabs Instant Voice Cloning API, then saves the
 * resulting voice_id to our `custom_voices` table.
 *
 * FormData fields:
 *   name        string   — display name
 *   description string?  — optional description
 *   language    string?  — ISO 639-1 code (default 'en')
 *   gender      string?  — 'male' | 'female' | 'neutral'
 *   file        File     — audio sample (.mp3 or .wav, max 25 MB)
 */
import { elevenlabs } from '@/lib/elevenlabs/client';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // Resolve workspace for this user
  const { data: ws } = await admin
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  const workspaceId = (ws as { id: string }).id;

  const formData = await req.formData();
  const name     = formData.get('name') as string | null;
  const desc     = formData.get('description') as string | null;
  const language = (formData.get('language') as string | null) ?? 'en';
  const gender   = (formData.get('gender')   as string | null) ?? null;
  const file     = formData.get('file') as File | null;

  if (!name?.trim() || !file) {
    return NextResponse.json({ error: 'name and file are required' }, { status: 400 });
  }

  // Insert a "cloning" row immediately so the UI can show progress
  const { data: voiceRow, error: insertErr } = await admin
    .from('custom_voices')
    .insert({
      workspace_id:     workspaceId,
      name:             name.trim(),
      provider:         'elevenlabs',
      provider_voice_id: 'pending',
      language,
      gender:           gender ?? null,
      status:           'cloning',
    })
    .select()
    .single();

  if (insertErr || !voiceRow) {
    return NextResponse.json({ error: insertErr?.message ?? 'DB error' }, { status: 500 });
  }

  const rowId = (voiceRow as { id: string }).id;

  try {
    // Build ElevenLabs form
    const elForm = new FormData();
    elForm.append('name', name.trim());
    if (desc) elForm.append('description', desc);
    elForm.append('files', file);

    const result = await elevenlabs.cloneVoice(elForm);
    const voiceId = result.voice_id;

    // Fetch preview URL from ElevenLabs
    let previewUrl: string | null = null;
    try {
      const voice = await elevenlabs.getVoice(voiceId);
      previewUrl = voice.preview_url ?? null;
    } catch { /* preview is optional */ }

    // Update our DB record with the real voice_id + preview
    await admin
      .from('custom_voices')
      .update({ provider_voice_id: voiceId, preview_url: previewUrl, status: 'ready' })
      .eq('id', rowId);

    return NextResponse.json({
      id:               rowId,
      provider_voice_id: voiceId,
      preview_url:      previewUrl,
      status:           'ready',
    }, { status: 201 });

  } catch (e) {
    // Mark the row as errored
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

  const admin = createAdminClient();
  const { data: ws } = await admin.from('workspaces').select('id').eq('owner_id', user.id).single();
  if (!ws) return NextResponse.json([]);

  const { data } = await admin
    .from('custom_voices')
    .select('*')
    .eq('workspace_id', (ws as { id: string }).id)
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

  // Fetch record to get provider_voice_id for cleanup
  const { data: voice } = await admin.from('custom_voices').select('*').eq('id', id).single();
  if (voice) {
    const v = voice as { provider: string; provider_voice_id: string };
    if (v.provider === 'elevenlabs' && v.provider_voice_id !== 'pending') {
      try { await elevenlabs.deleteVoice(v.provider_voice_id); } catch { /* non-fatal */ }
    }
  }

  const { error } = await admin.from('custom_voices').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
