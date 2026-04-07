export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from 'lib/db';
import { getSessionFromRequest } from 'lib/auth';

// GET /api/settings
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let settings = await prisma.appSetting.findFirst();
  if (!settings) {
    settings = await prisma.appSetting.create({ data: {} });
  }

  return NextResponse.json({ settings });
}

// PUT /api/settings
export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();

  const allowed = [
    'weeklyThresholdPercent',
    'monthlyThresholdPercent',
    'weeklyMinLeadsForTop',
    'monthlyMinLeadsForTop',
    'weeklyMinLeadsForTrigger',
    'monthlyMinLeadsForTrigger'
  ];

  const data: Record<string, number> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) {
      const val = parseFloat(body[key]);
      if (!isNaN(val) && val >= 0) data[key] = val;
    }
  }

  let settings = await prisma.appSetting.findFirst();
  if (!settings) {
    settings = await prisma.appSetting.create({ data });
  } else {
    settings = await prisma.appSetting.update({
      where: { id: settings.id },
      data
    });
  }

  return NextResponse.json({ ok: true, settings });
}
