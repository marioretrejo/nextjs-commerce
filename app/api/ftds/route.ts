export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from 'lib/db';
import { parseFtdMessage, isParseError } from 'lib/parser';
import { recalculateAndPersist, getSettings } from 'lib/metrics';
import { evaluateFullTrigger } from 'lib/trigger';
import { getCampaignRank } from 'lib/ranking';
import { getTrendAnalysis, getHistoricalMetrics } from 'lib/memory';
import { getSessionFromRequest } from 'lib/auth';

// GET /api/ftds  → list FTDs with optional filters
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const campaignBase = searchParams.get('campaignBase');
  const country = searchParams.get('country');
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (campaignBase) where.campaignBase = { contains: campaignBase };
  if (country) where.country = { contains: country };

  const [ftds, total] = await Promise.all([
    prisma.ftd.findMany({
      where,
      orderBy: { registrationDate: 'desc' },
      take: limit,
      skip
    }),
    prisma.ftd.count({ where })
  ]);

  return NextResponse.json({ ftds, total, page, limit });
}

// POST /api/ftds  → parse raw message and save FTD
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  const rawMessage: string = body.rawMessage ?? '';

  if (!rawMessage.trim()) {
    return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 });
  }

  const parsed = parseFtdMessage(rawMessage);
  if (isParseError(parsed)) {
    return NextResponse.json({ error: parsed.error }, { status: 422 });
  }

  // Check for duplicate
  const existing = await prisma.ftd.findUnique({
    where: { dedupeHash: parsed.dedupeHash }
  });
  if (existing) {
    return NextResponse.json(
      {
        duplicate: true,
        message: 'Este FTD ya fue registrado anteriormente.',
        existingId: existing.id,
        ftd: existing
      },
      { status: 409 }
    );
  }

  // Save FTD
  const ftd = await prisma.ftd.create({
    data: {
      providerSource: parsed.providerSource,
      eventType: parsed.eventType,
      businessName: parsed.businessName,
      registrationDate: parsed.registrationDate,
      customerName: parsed.customerName,
      amount: parsed.amount,
      rawCampaignName: parsed.rawCampaignName,
      campaignBase: parsed.campaignBase,
      campaignVariant: parsed.campaignVariant,
      country: parsed.country,
      finalReferenceName: parsed.finalReferenceName,
      isSameDay: parsed.isSameDay,
      isDelayedFtd: parsed.isDelayedFtd,
      rawMessage,
      dedupeHash: parsed.dedupeHash
    }
  });

  // Recalculate metrics for this campaign+country
  const { weekly, monthly } = await recalculateAndPersist(
    parsed.campaignBase,
    parsed.country
  );

  // Full trigger evaluation
  const settings = await getSettings();
  const trigger = evaluateFullTrigger(
    weekly,
    monthly,
    parsed.isDelayedFtd,
    parsed.isSameDay,
    settings
  );

  // Get top rank + trend + last 4 weeks history (all in parallel)
  const [weeklyRank, monthlyRank, trend, weeklyHistory] = await Promise.all([
    getCampaignRank(parsed.campaignBase, parsed.country, 'weekly', settings),
    getCampaignRank(parsed.campaignBase, parsed.country, 'monthly', settings),
    getTrendAnalysis(parsed.campaignBase, parsed.country),
    getHistoricalMetrics(parsed.campaignBase, parsed.country, 'weekly', 4)
  ]);

  return NextResponse.json({
    ok: true,
    ftd,
    analysis: {
      campaign: parsed.campaignBase,
      country: parsed.country,
      rawCampaignName: parsed.rawCampaignName,
      isDelayed: parsed.isDelayedFtd,
      isSameDay: parsed.isSameDay,
      weekly: {
        ftds: weekly.totalFtds,
        leads: weekly.totalLeads,
        conversion: weekly.conversionRate,
        pendingLeads: weekly.pendingLeads
      },
      monthly: {
        ftds: monthly.totalFtds,
        leads: monthly.totalLeads,
        conversion: monthly.conversionRate,
        pendingLeads: monthly.pendingLeads
      },
      trigger,
      weeklyRank,
      monthlyRank,
      trend,
      weeklyHistory
    }
  });
}
