import { NextRequest, NextResponse } from 'next/server';
import { prisma } from 'lib/db';
import { getSessionFromRequest } from 'lib/auth';

// GET /api/crm  → list CRM actions
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const skip = (page - 1) * limit;

  const [actions, total] = await Promise.all([
    prisma.crmAction.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip
    }),
    prisma.crmAction.count()
  ]);

  return NextResponse.json({ actions, total });
}

// POST /api/crm  → record a CRM action
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { campaignBase, country, actionType, reason, sourceMetricId } = await req.json();

  if (!campaignBase || !country || !['duplicate', 'hide', 'monitor'].includes(actionType)) {
    return NextResponse.json(
      { error: 'Campos requeridos: campaignBase, country, actionType (duplicate|hide|monitor)' },
      { status: 400 }
    );
  }

  const action = await prisma.crmAction.create({
    data: {
      campaignBase: campaignBase.trim(),
      country: country.trim(),
      actionType,
      reason: reason?.trim() ?? null,
      sourceMetricId: sourceMetricId ?? null
    }
  });

  return NextResponse.json({ ok: true, action });
}
