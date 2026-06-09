/**
 * Startup Zombie-Call Reconciliation
 *
 * On every worker restart, scans the `calls` table for rows that are still
 * marked `in_progress` or `dialing` and cross-references them with the live
 * rooms reported by LiveKit. Any DB-active call whose LiveKit room no longer
 * exists is a "zombie" — the previous worker process crashed before it could
 * write a `completed` status. This routine:
 *   1. Marks each zombie call as `completed` (status) with a cleanup note in
 *      `extracted_data._cleanup_reason`.
 *   2. Calls `release_call_slot` for the owning workspace so the concurrent-
 *      call counter is decremented and the user can place new calls immediately.
 *
 * Must be awaited BEFORE cli.runApp() so the DB is reconciled before the
 * worker starts accepting new LiveKit sessions.
 */
import { createClient } from '@supabase/supabase-js';

export async function runStartupCleanup(): Promise<void> {
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const lkUrl       = process.env['LIVEKIT_URL'] ?? '';
  const lkKey       = process.env['LIVEKIT_API_KEY'];
  const lkSecret    = process.env['LIVEKIT_API_SECRET'];

  if (!supabaseUrl || !supabaseKey) {
    console.log('[startup-cleanup] Skipping — Supabase env vars not configured');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // ── Step 1: find all DB-active calls ──────────────────────────────────────
  const { data: activeCalls, error } = await supabase
    .from('calls')
    .select('id, retell_call_id, workspace_id, status')
    .in('status', ['in_progress', 'dialing']);

  if (error) {
    console.error('[startup-cleanup] DB query failed:', error.message);
    return;
  }

  if (!activeCalls?.length) {
    console.log('[startup-cleanup] No active calls in DB — nothing to reconcile');
    return;
  }

  console.log(`[startup-cleanup] Found ${activeCalls.length} DB-active call(s) — verifying against LiveKit`);

  // ── Step 2: fetch live rooms from LiveKit (10 s timeout) ─────────────────
  const liveRooms    = new Set<string>();
  let   lkReachable  = false;

  if (lkUrl && lkKey && lkSecret) {
    try {
      const httpUrl = lkUrl.replace('wss://', 'https://').replace('ws://', 'http://');
      const { RoomServiceClient } = await import('livekit-server-sdk');
      const roomSvc = new RoomServiceClient(httpUrl, lkKey, lkSecret);
      const rooms = await Promise.race([
        roomSvc.listRooms(),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('listRooms timeout')), 10_000)
        ),
      ]);
      for (const r of rooms) if (r.name) liveRooms.add(r.name);
      lkReachable = true;
      console.log(`[startup-cleanup] LiveKit reports ${liveRooms.size} live room(s)`);
    } catch (err) {
      console.error('[startup-cleanup] LiveKit unreachable:', String(err));
      // Fall through with lkReachable = false
    }
  } else {
    console.log('[startup-cleanup] LiveKit env vars not set — treating all active calls as zombies');
  }

  // ── Step 3: cross-reference and clean up zombies ──────────────────────────
  // Decision rule:
  //   • LiveKit reachable  → zombie iff room is absent from liveRooms
  //   • LiveKit unreachable → treat ALL active calls as zombies (worker just
  //     restarted; previous process is guaranteed dead for single-instance deploys)
  const cleanedAt = new Date().toISOString();
  let cleaned = 0;

  for (const call of activeCalls) {
    const roomName     = (call.retell_call_id as string | null) ?? '';
    const workspaceId  = call.workspace_id as string | null;

    const isZombie = lkReachable
      ? !!roomName && !liveRooms.has(roomName)
      : true;

    if (!isZombie) continue;

    console.log(
      `[startup-cleanup] Zombie → id=${call.id} room=${roomName || '(null)'} ` +
      `workspace=${workspaceId ?? 'unknown'} prev_status=${call.status}`
    );

    // Mark call completed with cleanup audit trail
    const { error: updateErr } = await supabase
      .from('calls')
      .update({
        status:        'completed',
        extracted_data: {
          _cleanup_reason: 'ZOMBIE_CLEANUP_AUTO',
          _cleaned_at:     cleanedAt,
        },
      })
      .eq('id', call.id);

    if (updateErr) {
      console.error(`[startup-cleanup] Update failed for call ${call.id}:`, updateErr.message);
      continue;
    }

    // Release call slot so concurrent-call counter reflects reality
    if (workspaceId) {
      await supabase
        .rpc('release_call_slot', { p_workspace_id: workspaceId })
        .then(() => null, () => null);
    }

    cleaned++;
  }

  console.log(
    `[startup-cleanup] Reconciliation complete — ` +
    `${cleaned} zombie(s) cleaned, ` +
    `${activeCalls.length - cleaned} call(s) confirmed live`
  );
}
