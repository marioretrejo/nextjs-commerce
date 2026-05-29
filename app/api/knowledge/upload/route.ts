/**
 * POST /api/knowledge/upload
 *
 * Ingests text content into a knowledge base:
 *   1. Splits content into overlapping chunks
 *   2. Generates embeddings via OpenAI text-embedding-3-small
 *   3. Stores chunks + vectors in document_chunks
 *
 * Body: { kb_id, content, source_name }
 * Returns: { chunks_created, skipped_embeddings }
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateEmbedding, chunkText } from '@/lib/embeddings';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    kb_id:       string;
    content:     string;
    source_name: string;
  };

  if (!body.kb_id || !body.content?.trim() || !body.source_name?.trim()) {
    return NextResponse.json({ error: 'kb_id, content, and source_name are required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify KB belongs to one of the user's workspaces
  const { data: kb } = await admin
    .from('knowledge_bases')
    .select('id, workspace_id')
    .eq('id', body.kb_id)
    .single();

  if (!kb) return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });

  const workspaceId = (kb as { workspace_id: string }).workspace_id;

  // Verify user is a member of this workspace
  const { data: ws } = await admin
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', user.id)
    .single();

  if (!ws) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Delete existing chunks from this source (replace / re-index)
  await admin
    .from('document_chunks')
    .delete()
    .eq('kb_id', body.kb_id)
    .eq('source_name', body.source_name);

  const chunks = chunkText(body.content);
  let skippedEmbeddings = 0;

  // Process chunks — generate embeddings in batches of 5 to avoid rate limits
  const BATCH = 5;
  const rows: {
    kb_id:        string;
    workspace_id: string;
    source_name:  string;
    chunk_index:  number;
    content:      string;
    embedding:    number[] | null;
  }[] = [];

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const embeddings = await Promise.all(batch.map((c) => generateEmbedding(c)));

    for (let j = 0; j < batch.length; j++) {
      if (!embeddings[j]) skippedEmbeddings++;
      rows.push({
        kb_id:        body.kb_id,
        workspace_id: workspaceId,
        source_name:  body.source_name.trim(),
        chunk_index:  i + j,
        content:      batch[j] ?? '',
        embedding:    embeddings[j] ?? null,
      });
    }
  }

  const { error } = await admin.from('document_chunks').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    chunks_created:     rows.length,
    skipped_embeddings: skippedEmbeddings,
    has_rag:            skippedEmbeddings < rows.length,
  });
}
