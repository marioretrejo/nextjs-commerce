import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

// Uses the SAME createClient() as the app layout — diagnoses why layout getUser() fails.
// /api/debug is in PUBLIC_PATHS so this runs without middleware auth check.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env['DIRECT_ACCESS_SECRET']) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let getUserResult: unknown = null;
  let getUserError: unknown = null;
  let cookieNames: string[] = [];

  try {
    const { cookies } = await import('next/headers');
    const store = await cookies();
    cookieNames = store.getAll().map(c => c.name);

    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    getUserResult = data.user ? { id: data.user.id, email: data.user.email } : null;
    getUserError = error?.message ?? null;
  } catch (e) {
    getUserError = String(e);
  }

  return NextResponse.json({
    cookieNames,
    getUser: { result: getUserResult, error: getUserError },
  });
}
