# VoiceOS — Production Loop Log

## FASE 1 — Branch sync (`merge origin/main`)

- **Inspected** real divergence: branch is 215 commits ahead of the merge-base;
  origin/main has 15 commits (white-label branding, latency optimization,
  logo upload, admin Plan selector) the branch lacks.
- **Attempted** the merge → 11 conflicts.
- **Resolved safely:** `middleware.ts` (kept FASE 0 security), `worker_core.ts`
  (kept branch's tested worker), `dist/worker.mjs` + `pnpm-lock.yaml` (artifacts),
  `app/(app)/layout.tsx` (clean prop-union of branding + QAC).
- **Blocker:** 5 UI files (sidebar/header/WorkspaceCommandCenter/plan-route/cartesia)
  diverged into different render logic; correct reconciliation needs visual QA that
  isn't possible headless. See `reports/BLOCKERS.md`.
- **Outcome:** `git merge --abort` (reversible). Branch stays clean/building/green
  at `fbdd928`. GATE not passed → documented, per protocol.

### Prior completed slices on this branch (context)

- FASE 0 security: removed `/api/debug*` + `direct-access`, killed the
  `x-debug-auth-reason` leak. (`543c687`)
- FASE B4: central `lib/groq.ts`; all Anthropic routes migrated to Groq;
  `@anthropic-ai/sdk` removed. (`fbdd928`) — tsc 0, eslint 0, 450 tests, build OK.

## FASE 2 — Continuous dialer activation ✅

- **Bug found (P1, revenue):** `dialContact` in `app/api/cron/campaign-dial/route.ts`
  flipped a contact to `status='calling'` with `.eq("id", …)` only — no
  compare-and-swap, no rowcount check. Two concurrent runners (the 60s worker +
  the Vercel daily cron, or overlapping worker cycles) both claim the same
  pending contact → **double-dial → double-billing + call-frequency breach.**
- **Fix (test-first, per rule):** the claim is now a CAS —
  `UPDATE … SET status='calling' WHERE id=? AND status='pending' RETURNING id`;
  a runner whose update affects 0 rows releases its call slot and skips. Added
  two `node:test` cases ("Double-dial prevention — compare-and-swap claim").
- **Enabled** `VOICEOS_RUN_CAMPAIGN_DIAL=true` in `render.yaml` (worker dials
  every 60s).
- **Removed** the redundant `/api/cron/campaign-dial` Vercel cron (`0 8 * * *`);
  the worker owns continuous dialing and the CAS makes multiple triggers safe.
  Kept the route + its Vercel function config (the worker proxies to it).
- **Verified guards** already present and correct: retry gate (cooldown +
  `attempts < max_retries`), `is_suspended`, `minutes_used >= minutes_limit`,
  `max_concurrency`, DNC, TCPA hours.
- GATE: prettier ✓, lint ✓, 452 unit tests ✓ (was 450), build ✓.

## FASE 3 — Retell removal ✅ (SDK fully removed)

- **Deleted:** `lib/retell/`, `app/api/webhooks/retell/`, the dead
  `app/api/agents/[id]/test-call` route (no callers), and
  `app/api/agents/[id]/web-call` (only the widget used it).
- **Widget rewrite:** `app/widget/[agent_id]/page.tsx` now runs on LiveKit
  (`@livekit/components-react` `<LiveKitRoom>` + `/api/livekit/token`), mirroring
  the proven agent test page. Same session-gated auth model — no new public
  token-minting surface. ⚠️ Needs live QA (browser voice UX not verifiable here).
- **campaigns/launch:** removed the Retell `batchCall` branch; launch now just
  marks the campaign active and the continuous LiveKit-SIP dialer (FASE 2) places
  the calls. Dropped the now-pointless `TWILIO_PHONE_NUMBER` guard that would
  have blocked SIP-only launches.
- **Deps removed:** `retell-sdk`, `retell-client-js-sdk` (package.json: 0 retell).
- **vercel.json:** removed the retell webhook function entry.
- **Migration 074:** deprecates `retell_*` columns (COMMENT only) — NOT dropped,
  per the "don't destroy data" rule and because `calls.retell_call_id` is still
  the LiveKit room/call dedup key.
- **Marketing/comment cleanup:** removed stale "Retell AI"/"ElevenLabs" claims in
  `app/page.tsx` and a stale comment in `qa/score`.
- **Gate exception (documented):** the literal "0 `retell` references" gate is not
  met because `retell_call_id` / `retell_agent_id` / `retell_batch_call_id` /
  `retell_kb_id` remain as **legacy column names** — kept intentionally per the
  inviolable "deprecate, don't drop" rule. All _active SDK usage_ is gone.
- GATE: tsc 0, lint ✓, 452 unit tests ✓, build ✓.

## Technical debt surfaced

- `dist/worker.mjs` (1.4 MB build artifact) is tracked in git — should be
  `.gitignore`d and removed from the tree.
- main's `worker_core.ts` latency optimizations are not on this branch; port them
  with a live-call test harness (needs real credentials).
