import { NextRequest, NextResponse } from 'next/server';
import { prisma } from 'lib/db';
import bcrypt from 'bcryptjs';

// POST /api/seed  → creates admin user if none exists
export async function POST(req: NextRequest) {
  const existing = await prisma.user.findFirst();
  if (existing) {
    return NextResponse.json({ message: 'Ya existe un usuario admin' });
  }

  const rawPassword = process.env.TRACKER_ADMIN_PASSWORD ?? 'admin123';
  const passwordHash = await bcrypt.hash(rawPassword, 12);

  const user = await prisma.user.create({
    data: { username: 'admin', passwordHash }
  });

  // Also create default settings
  const settingsExist = await prisma.appSetting.findFirst();
  if (!settingsExist) {
    await prisma.appSetting.create({ data: {} });
  }

  return NextResponse.json({ ok: true, username: user.username });
}
