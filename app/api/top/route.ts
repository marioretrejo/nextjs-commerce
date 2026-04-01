import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from 'lib/auth';
import { buildTopRanking } from 'lib/ranking';
import { getSettings } from 'lib/metrics';

// GET /api/top  → get top-ranked campaigns by period
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const periodType = (searchParams.get('periodType') ?? 'weekly') as 'weekly' | 'monthly';
  const limitParam = parseInt(searchParams.get('limit') ?? '10', 10);

  const settings = await getSettings();
  const ranking = await buildTopRanking(periodType, settings);

  return NextResponse.json({
    ranking: ranking.slice(0, limitParam),
    periodType,
    total: ranking.length
  });
}
