import { NextRequest, NextResponse } from 'next/server';
import { prisma } from 'lib/db';
import { getSessionFromRequest } from 'lib/auth';

// GET /api/alerts  → list alerts
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status'); // active | seen | resolved | all
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status && status !== 'all') where.status = status;
  else if (!status) where.status = 'active'; // default to active alerts

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      orderBy: { triggeredAt: 'desc' },
      take: limit,
      skip
    }),
    prisma.alert.count({ where })
  ]);

  return NextResponse.json({ alerts, total, page, limit });
}

// PATCH /api/alerts  → update alert status
export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id, status } = await req.json();
  if (!id || !['active', 'seen', 'resolved'].includes(status)) {
    return NextResponse.json({ error: 'ID y status válido requeridos' }, { status: 400 });
  }

  const alert = await prisma.alert.update({
    where: { id },
    data: { status }
  });

  return NextResponse.json({ ok: true, alert });
}

// DELETE /api/alerts  → mark all active alerts as resolved
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  await prisma.alert.updateMany({
    where: { status: 'active' },
    data: { status: 'resolved' }
  });

  return NextResponse.json({ ok: true });
}
