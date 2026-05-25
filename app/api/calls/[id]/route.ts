import { createClient } from '@/lib/supabase/server';
import { sanitizeCallForClient } from '@/lib/sanitize';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('calls')
    .select('*, agent:agents(*), campaign:campaigns(name)')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(sanitizeCallForClient(data as Record<string, unknown>));
}
