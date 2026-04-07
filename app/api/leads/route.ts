export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from 'lib/db';
import { recalculateAndPersist } from 'lib/metrics';
import { getSessionFromRequest } from 'lib/auth';

// GET /api/leads  → list daily leads
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

  const [leads, total] = await Promise.all([
    prisma.dailyLead.findMany({
      where,
      orderBy: [{ date: 'desc' }, { campaignBase: 'asc' }],
      take: limit,
      skip
    }),
    prisma.dailyLead.count({ where })
  ]);

  return NextResponse.json({ leads, total, page, limit });
}

// POST /api/leads  → create or update daily lead entry
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  const { date, campaignBase, country, leads } = body;

  if (!date || !campaignBase || !country || leads === undefined) {
    return NextResponse.json(
      { error: 'Campos requeridos: date, campaignBase, country, leads' },
      { status: 400 }
    );
  }

  if (typeof leads !== 'number' || leads < 0) {
    return NextResponse.json({ error: 'El campo leads debe ser un número >= 0' }, { status: 400 });
  }

  // Normalize date to midnight UTC
  const dateObj = new Date(date);
  dateObj.setHours(0, 0, 0, 0);

  const record = await prisma.dailyLead.upsert({
    where: {
      date_campaignBase_country: {
        date: dateObj,
        campaignBase: campaignBase.trim(),
        country: country.trim()
      }
    },
    update: { leads },
    create: {
      date: dateObj,
      campaignBase: campaignBase.trim(),
      country: country.trim(),
      leads
    }
  });

  // Recalculate metrics after updating leads
  const { weekly, monthly } = await recalculateAndPersist(
    record.campaignBase,
    record.country
  );

  return NextResponse.json({ ok: true, record, weekly, monthly });
}

// DELETE /api/leads  → remove a daily lead entry by id
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get('id') ?? '', 10);
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const record = await prisma.dailyLead.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

  await prisma.dailyLead.delete({ where: { id } });

  // Recalculate metrics
  await recalculateAndPersist(record.campaignBase, record.country);

  return NextResponse.json({ ok: true });
}
