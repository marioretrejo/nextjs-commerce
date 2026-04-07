export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from 'lib/db';
import { getSessionFromRequest } from 'lib/auth';

// PATCH /api/crm/[id]  → update status of a CRM action
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const actionId = parseInt(id, 10);
  if (isNaN(actionId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const { status } = await req.json();
  if (!['pending', 'executed', 'skipped'].includes(status)) {
    return NextResponse.json(
      { error: 'Status inválido. Usar: pending | executed | skipped' },
      { status: 400 }
    );
  }

  const action = await prisma.crmAction.update({
    where: { id: actionId },
    data: {
      status,
      executedAt: status === 'executed' ? new Date() : null
    }
  });

  return NextResponse.json({ ok: true, action });
}
