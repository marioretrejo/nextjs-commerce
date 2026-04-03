// GET /api/healthz – lightweight liveness/readiness probe for Kubernetes.
// Does NOT require authentication. Checks DB connectivity so the readiness
// probe returns 503 when the database is unreachable (prevents traffic to
// a pod that cannot serve requests).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Lightweight connectivity check; avoids touching application tables
    await (db as any).$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ status: 'db_unavailable' }, { status: 503 })
  }
}
