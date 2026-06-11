# VoiceOS — Production Readiness Runbook

This document covers the full deployment lifecycle: pre-deploy gate, post-deploy verification,
env var reference per platform, cron inventory, rollback procedure, and the checklist for
enabling the first real call in production.

---

## Table of Contents

1. [Pre-Deploy Checklist](#1-pre-deploy-checklist)
2. [Environment Variables Reference](#2-environment-variables-reference)
3. [Cron Jobs Inventory](#3-cron-jobs-inventory)
4. [Post-Deploy Smoke Test](#4-post-deploy-smoke-test)
5. [Rollback Procedure](#5-rollback-procedure)
6. [Incident Response](#6-incident-response)
7. [First Real Call Gate](#7-first-real-call-gate)
8. [Automated Gate Scripts](#8-automated-gate-scripts)

---

## 1. Pre-Deploy Checklist

Run through this list before every production deploy.

### 1.1 — Code Quality

- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] `pnpm prettier --check .` — zero formatting errors
- [ ] `pnpm test:unit` — all unit tests pass
- [ ] `pnpm build` — Next.js build succeeds
- [ ] `pnpm build:worker` — agent worker build succeeds

### 1.2 — Database Migrations

- [ ] All pending migrations listed in `supabase/migrations/` are applied to the target project
- [ ] Verify with Supabase MCP: `list_migrations` shows no unapplied files
- [ ] RLS policies are in place for all tables added in recent migrations
- [ ] No destructive migrations (DROP TABLE, DROP COLUMN) without verified backups

### 1.3 — Environment Variables

- [ ] Run `npx tsx scripts/production-readiness-check.ts --env production` — status PASS
- [ ] All CRITICAL vars set in Vercel (next.js app)
- [ ] All CRITICAL vars set in Render (agent worker)
- [ ] `INTERNAL_API_SECRET` ≥ 32 chars, not a weak default
- [ ] `CRON_SECRET` set or `INTERNAL_API_SECRET` used as fallback
- [ ] `VOICEOS_ALERTING_SEND_EXTERNAL=false` unless explicitly enabling external alerts
- [ ] `LOAD_TEST_MODE` is unset or `false` in production

### 1.4 — Security

- [ ] No secrets committed to git (`git log --oneline | head -20` + manual scan)
- [ ] All cron routes use `timingSafeEqual` (verified by readiness check)
- [ ] `INTERNAL_API_SECRET` is not `secret`, `changeme`, `test`, or similar
- [ ] Stripe keys are live keys (`sk_live_`, `whsec_`) not test keys
- [ ] Supabase service role key is production key, not dev project key

### 1.5 — Vercel Configuration

- [ ] `vercel.json` cron schedules are correct (see §3)
- [ ] `maxDuration` for cron routes ≤ 300 (Vercel Pro limit)
- [ ] No cron routes inadvertently protected by auth middleware

---

## 2. Environment Variables Reference

### 2.1 — Vercel (Next.js App)

| Variable                             |  Required   | Notes                                       |
| ------------------------------------ | :---------: | ------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`           |      ✓      | Supabase project URL                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      |      ✓      | Public anon key — safe to expose            |
| `SUPABASE_SERVICE_ROLE_KEY`          |      ✓      | Service role — never expose client-side     |
| `INTERNAL_API_SECRET`                |      ✓      | Min 32 chars. `openssl rand -hex 32`        |
| `CRON_SECRET`                        | recommended | Vercel-injected cron auth secret            |
| `STRIPE_SECRET_KEY`                  |      ✓      | `sk_live_...`                               |
| `STRIPE_WEBHOOK_SECRET`              |      ✓      | `whsec_...` from Stripe Dashboard           |
| `STRIPE_PRICE_PRO`                   |      ✓      | Stripe price ID for Pro plan                |
| `STRIPE_PRICE_SCALE`                 |      ✓      | Stripe price ID for Scale plan              |
| `LIVEKIT_URL`                        |      ✓      | `wss://your-project.livekit.cloud`          |
| `TWILIO_AUTH_TOKEN`                  |      ✓      | Webhook signature validation                |
| `TWILIO_ACCOUNT_SID`                 |      ✓      | Outbound call initiation                    |
| `GROQ_API_KEY`                       | recommended | Post-call CRM extraction (primary LLM)      |
| `OPENAI_API_KEY`                     | recommended | Post-call CRM extraction (fallback LLM)     |
| `VOICEOS_WEBHOOK_SIGNING_SECRET`     | recommended | Signs outbound webhook payloads             |
| `VOICEOS_ALERTING_SEND_EXTERNAL`     |  optional   | Default `false`. Set `true` for Slack/email |
| `VOICEOS_ALERTING_SLACK_WEBHOOK_URL` |  optional   | Slack incoming webhook URL                  |
| `VOICEOS_ALERTING_DEFAULT_EMAIL`     |  optional   | Alert delivery email                        |

### 2.2 — Render (Agent Worker)

| Variable                         |  Required   | Notes                              |
| -------------------------------- | :---------: | ---------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`       |      ✓      | Same as Vercel                     |
| `SUPABASE_SERVICE_ROLE_KEY`      |      ✓      | Same as Vercel                     |
| `INTERNAL_API_SECRET`            |      ✓      | Must match Vercel value            |
| `GROQ_API_KEY`                   |      ✓      | Primary LLM (`llama-4-scout-17b`)  |
| `OPENAI_API_KEY`                 | recommended | Fallback LLM + TTS fallback        |
| `CARTESIA_API_KEY`               | recommended | Primary TTS (lower latency)        |
| `DEEPGRAM_API_KEY`               |      ✓      | STT (`nova-2` model)               |
| `LIVEKIT_API_KEY`                |      ✓      | LiveKit project API key            |
| `LIVEKIT_API_SECRET`             |      ✓      | LiveKit project API secret         |
| `LIVEKIT_URL`                    |      ✓      | `wss://your-project.livekit.cloud` |
| `TWILIO_AUTH_TOKEN`              |      ✓      | Webhook validation                 |
| `TWILIO_ACCOUNT_SID`             |      ✓      | Outbound dialing                   |
| `VOICEOS_WEBHOOK_SIGNING_SECRET` | recommended | Signs outbound webhooks            |

### 2.3 — Unsafe Defaults (blocked in production)

The readiness check will FAIL if any of these values are detected:

- `INTERNAL_API_SECRET`: `secret`, `changeme`, `test`, `password`, `internal`, `development`, `12345`, `admin`
- `VOICEOS_WEBHOOK_SIGNING_SECRET`: same list
- Any key with value `your_*` or `placeholder`

---

## 3. Cron Jobs Inventory

All crons are configured in `vercel.json`. Requires **Vercel Pro** or **Enterprise**.

| Route                       | Schedule      | `maxDuration` | Purpose                                          |
| --------------------------- | ------------- | :-----------: | ------------------------------------------------ |
| `/api/cron/alerts`          | `*/5 * * * *` |      60s      | Evaluate alert signals, create/resolve incidents |
| `/api/cron/provider-health` | `*/5 * * * *` |      60s      | Compute provider health snapshots                |
| `/api/cron/post-call-jobs`  | `* * * * *`   |     300s      | Process post-call job queue                      |
| `/api/cron/campaign-dial`   | `* * * * *`   |      60s      | Advance campaign call queues                     |
| `/api/cron/reset-minutes`   | `0 0 1 * *`   |       —       | Reset workspace minute counters (1st of month)   |
| `/api/cron/data-retention`  | `0 2 1 * *`   |     300s      | GDPR/CCPA data retention cleanup (1st of month)  |

**Auth**: All cron routes require `Authorization: Bearer <CRON_SECRET>` or `Authorization: Bearer <INTERNAL_API_SECRET>`. Vercel injects `CRON_SECRET` automatically for cron triggers.

**Middleware exemption**: All `/api/cron/*` routes must be in the `PUBLIC_PATHS` array in
`middleware.ts` so auth middleware does not redirect them before the route handler can
validate the Bearer token.

### Manual trigger (for testing / incident recovery)

```bash
curl -H "Authorization: Bearer $INTERNAL_API_SECRET" \
  "https://your-app.vercel.app/api/cron/alerts"
```

---

## 4. Post-Deploy Smoke Test

After every deploy (automated or manual), run the deployment smoke test:

### 4.1 — Without credentials (PARTIAL PASS acceptable for CI)

```bash
npx tsx scripts/deployment-smoke-test.ts \
  --base-url https://your-app.vercel.app \
  --safe-mode
```

Expected result: **PARTIAL PASS** (T1–T4 pass, T5–T8 skipped).

### 4.2 — Full verification (requires secrets)

```bash
npx tsx scripts/deployment-smoke-test.ts \
  --base-url https://your-app.vercel.app \
  --internal-secret "$INTERNAL_API_SECRET" \
  --workspace-id "<uuid>" \
  --safe-mode
```

Expected result: **FULL PASS** (T1–T7 pass, T8 skipped if no `--auth-cookie`).

### 4.3 — What each test checks

| Test | What it verifies                                          |
| ---- | --------------------------------------------------------- |
| T1   | `GET /api/health` returns 200 with `{"status":"ok"}`      |
| T2   | All 6 cron routes return 401 without auth                 |
| T3   | Protected APIs return 401/307/302 without auth            |
| T4   | Cron routes are NOT redirected by middleware (no 307)     |
| T5   | Valid secret → cron returns 200 and `external_sent=0`     |
| T6   | Response bodies contain no leaked secrets                 |
| T7   | No real provider calls made (safe-mode guard)             |
| T8   | Authenticated API access works (requires `--auth-cookie`) |

---

## 5. Rollback Procedure

### 5.1 — Vercel rollback (no DB changes)

1. Go to Vercel Dashboard → Deployments
2. Find the last known-good deployment
3. Click "..." → **Promote to Production**
4. Verify `/api/health` returns 200

### 5.2 — Vercel rollback + DB migration reversal

> Only for destructive migrations. Non-destructive migrations (ADD COLUMN, CREATE TABLE)
> are safe to leave in place during a code rollback.

1. Roll back Vercel deployment (§5.1)
2. Apply the reverse migration SQL manually via Supabase MCP or Dashboard SQL editor
3. Verify affected tables/columns with `list_tables`
4. Re-run smoke test

### 5.3 — Render worker rollback

1. Go to Render Dashboard → Service → Deploys
2. Click the last stable deploy → **Rollback to this deploy**
3. Monitor logs for any startup errors

### 5.4 — Emergency: disable agent worker

If the worker is causing call failures, set `VOICEOS_WORKER_ENABLED=false` in Render env vars
and redeploy. All inbound calls will receive a graceful error response without crashing.

---

## 6. Incident Response

### 6.1 — Alert incident received

1. Check `/provider-health` dashboard for active incidents
2. Acknowledge the incident (prevents repeat notifications during investigation)
3. Identify the signal type:
   - `webhook_failure_rate` → check outbound webhook URLs, inspect `outbound_webhook` job failures
   - `fallback_spike` → LLM/TTS primary provider may be down; verify provider status pages
   - `dead_letter_queue` → jobs stuck in `dead_letter` status; inspect `post_call_jobs` table
   - `stale_job` → cron may be blocked; check Vercel cron logs
   - `cron_stale` → cron not running; verify Vercel cron is enabled for the project
   - `billing_circuit_breaker` → Stripe is failing; check Stripe status page and API keys

### 6.2 — Cron not running

```bash
# Check when the cron last ran
curl -H "Authorization: Bearer $INTERNAL_API_SECRET" \
  "https://your-app.vercel.app/api/cron/alerts" | jq .

# Manually trigger post-call job recovery
curl -H "Authorization: Bearer $INTERNAL_API_SECRET" \
  "https://your-app.vercel.app/api/cron/recover-missing-post-call-jobs?hours=24&dry_run=1"
```

### 6.3 — High call failure rate

1. Check `provider_health_checks` table for recent snapshots
2. Verify `GET /api/qac/provider-health` for aggregated status
3. If one provider is failing, rotate its API key in Render env vars and redeploy worker
4. Monitor `call_events` for `error` events to identify the failure point

### 6.4 — Data breach / secret exposure

1. Immediately rotate all secrets (`INTERNAL_API_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, etc.)
2. Update all env vars in Vercel and Render
3. Redeploy both services
4. Review `audit_logs` table for unauthorized access
5. File incident report

---

## 7. First Real Call Gate

Before enabling production calling, verify **all** of the following:

### 7.1 — Infrastructure requirements

- [ ] Supabase project on paid plan (not Free tier — concurrent connection limit)
- [ ] Render worker on Standard plan or higher (not Free — no sleep)
- [ ] Vercel on Pro plan or higher (cron requires Pro)
- [ ] LiveKit Cloud project created and `LIVEKIT_URL` set to production URL
- [ ] Twilio phone number purchased and configured with the worker webhook URL
- [ ] Deepgram account active with sufficient balance

### 7.2 — Security requirements

- [ ] `INTERNAL_API_SECRET` is a 32+ char random hex string
- [ ] `VOICEOS_WEBHOOK_SIGNING_SECRET` is a 32+ char random hex string
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is the production project's service role key
- [ ] Stripe is in live mode (not test mode)
- [ ] RLS is enabled on all tables (verified via Supabase Dashboard)

### 7.3 — Functional requirements

- [ ] At least one workspace created in the database
- [ ] At least one agent created for that workspace
- [ ] At least one campaign created with valid `from_number`
- [ ] Worker startup logs show no errors
- [ ] `GET /api/health` returns `{"status":"ok"}`
- [ ] Alerting cron returns `ok: true` (run manually to verify)

### 7.4 — Smoke test requirements

- [ ] `npx tsx scripts/deployment-smoke-test.ts --base-url <prod-url> --safe-mode` → **FULL PASS**
- [ ] `npx tsx scripts/production-readiness-check.ts --env production` → **PASS**
- [ ] No `WARN` or `FAIL` items in readiness check output

### 7.5 — First call procedure

1. Create a test campaign with a single contact (your own number)
2. Set `max_concurrent_calls=1` and `calls_per_day_limit=1`
3. Trigger manually via `POST /api/campaigns/:id/start`
4. Monitor:
   - Worker logs in Render Dashboard
   - `call_events` table in Supabase for the call lifecycle
   - `calls` table for `status`, `duration`, `transcript`
5. Verify call completes with `status=completed` and transcript populated
6. Check `/provider-health` dashboard — no new incidents created
7. If successful: increase `max_concurrent_calls` gradually (2 → 5 → 10 → 50)

---

## 8. Automated Gate Scripts

### 8.1 — Production Readiness Check

```bash
# Local environment check
npx tsx scripts/production-readiness-check.ts --env local

# Staging (strict — warnings are failures)
npx tsx scripts/production-readiness-check.ts \
  --env staging \
  --base-url https://staging.your-app.vercel.app \
  --strict

# Production gate (skip live HTTP — run before deploy)
npx tsx scripts/production-readiness-check.ts \
  --env production \
  --skip-http

# Full JSON output for CI
npx tsx scripts/production-readiness-check.ts \
  --env production \
  --json \
  --skip-http
```

Exit codes: `0` = PASS, `1` = FAIL.

### 8.2 — Deployment Smoke Test

```bash
# CI / no-credentials (PARTIAL PASS expected)
npx tsx scripts/deployment-smoke-test.ts \
  --base-url https://your-app.vercel.app \
  --safe-mode

# Full post-deploy verification
npx tsx scripts/deployment-smoke-test.ts \
  --base-url https://your-app.vercel.app \
  --internal-secret "$INTERNAL_API_SECRET" \
  --safe-mode

# Require full authenticated pass (use in staging pipeline)
npx tsx scripts/deployment-smoke-test.ts \
  --base-url https://staging.your-app.vercel.app \
  --internal-secret "$INTERNAL_API_SECRET" \
  --auth-cookie "$SESSION_COOKIE" \
  --require-auth-full \
  --safe-mode
```

### 8.3 — CI Integration Example

```yaml
# .github/workflows/deploy-check.yml
- name: Production Readiness Gate
  run: npx tsx scripts/production-readiness-check.ts --env production --skip-http --json
  env:
    INTERNAL_API_SECRET: ${{ secrets.INTERNAL_API_SECRET }}

- name: Deployment Smoke Test
  run: |
    npx tsx scripts/deployment-smoke-test.ts \
      --base-url ${{ vars.STAGING_URL }} \
      --internal-secret ${{ secrets.INTERNAL_API_SECRET }} \
      --safe-mode
```

---

_Last updated: Fase 16 — Production Readiness + Staging Deployment Gate_
