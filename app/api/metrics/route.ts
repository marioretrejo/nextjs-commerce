export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from 'lib/db';
import { getSessionFromRequest } from 'lib/auth';
import { recalculateAndPersist, getCurrentWeekRange, getCurrentMonthRange } from 'lib/metrics';

// GET /api/metrics  → get persisted metrics, optionally filtered
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const campaignBase = searchParams.get('campaignBase');
  const country = searchParams.get('country');
  const periodType = searchParams.get('periodType') ?? 'weekly';
  const today = new Date();

  const range =
    periodType === 'monthly' ? getCurrentMonthRange(today) : getCurrentWeekRange(today);

  const where: Record<string, unknown> = {
    periodType,
    periodStart: range.start
  };
  if (campaignBase) where.campaignBase = { contains: campaignBase };
  if (country) where.country = { contains: country };

  const metrics = await prisma.campaignMetric.findMany({
    where,
    orderBy: [{ conversionRate: 'desc' }, { totalFtds: 'desc' }]
  });

  return NextResponse.json({ metrics, periodStart: range.start, periodEnd: range.end });
}

// POST /api/metrics/recalculate  → recalculate all campaign+country combinations
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  // Find all unique campaign+country combinations from FTDs and leads
  const [ftdGroups, leadGroups] = await Promise.all([
    prisma.ftd.groupBy({ by: ['campaignBase', 'country'] }),
    prisma.dailyLead.groupBy({ by: ['campaignBase', 'country'] })
  ]);

  const seen = new Set<string>();
  const pairs: { campaignBase: string; country: string }[] = [];

  for (const g of [...ftdGroups, ...leadGroups]) {
    const key = `${g.campaignBase}|${g.country}`;
    if (!seen.has(key)) {
      seen.add(key);
      pairs.push({ campaignBase: g.campaignBase, country: g.country });
    }
  }

  const results = await Promise.all(
    pairs.map((p) => recalculateAndPersist(p.campaignBase, p.country))
  );

  return NextResponse.json({ ok: true, recalculated: results.length });
}
