# VoiceOS Alerting + Incident Notifications (Fase 15)

## Overview

The alerting system monitors 13 operational signals across provider health, post-call job queues, webhook delivery, and billing infrastructure. When a signal fires, an **alert incident** is created (or updated). Notifications are delivered to one or more channels (dashboard, Slack, email, webhook).

All external sends (Slack, email, webhook) are **disabled by default**. Only the in-app dashboard channel is active out of the box. Enable external alerts by setting `VOICEOS_ALERTING_SEND_EXTERNAL=true`.

---

## Architecture

```
/api/cron/alerts (every 5 min)
    ↓
evaluateAlertSignals()         — queries DB, returns EvaluatedSignal[]
    ↓
createOrUpdateIncident()       — upsert by fingerprint (dedup)
    ↓
enqueueAlertDelivery()         — creates alert_deliveries row
    ↓
processDelivery()              — sends to channel driver
    ├── deliverDashboard()     — always enabled (DB-only)
    ├── deliverSlack()         — requires VOICEOS_ALERTING_SEND_EXTERNAL=true
    ├── deliverEmail()         — placeholder (not yet implemented)
    └── deliverWebhook()       — placeholder (not yet implemented)
```

Auto-resolve: any incident whose signal is no longer firing at the end of a cron run is automatically resolved.

---

## Signal Taxonomy (13 signals)

| Signal                         | Source                   | Severity | Default Cooldown |
| ------------------------------ | ------------------------ | -------- | ---------------- |
| `provider_down`                | `provider_health_checks` | critical | 30 min           |
| `provider_degraded`            | `provider_health_checks` | warning  | 60 min           |
| `circuit_open`                 | `provider_health_checks` | critical | 30 min           |
| `fallback_spike`               | `provider_health_checks` | warning  | 60 min           |
| `post_call_jobs_dead_letter`   | `post_call_jobs`         | critical | 30 min           |
| `post_call_jobs_stale_running` | `post_call_jobs`         | warning  | 60 min           |
| `webhook_failure_spike`        | `call_events`            | warning  | 60 min           |
| `cron_failure`                 | `provider_health_checks` | critical | 30 min           |
| `db_error_spike`               | `call_events`            | critical | 30 min           |
| `active_calls_zombie`          | `call_events`            | warning  | 120 min          |
| `call_failure_spike`           | `call_events`            | warning  | 60 min           |
| `cost_spike`                   | `call_events`            | warning  | 60 min           |
| `compliance_block_spike`       | `call_events`            | info     | 120 min          |

---

## Database Schema (Migration 061)

### `alert_rules`

Per-workspace rule configuration. When no rules exist, code-side defaults are used.

- `workspace_id` — NULL = global rule
- `signal` — one of the 13 signals above
- `severity` — info | warning | critical
- `channels` — jsonb array of channel names
- `cooldown_minutes` — minimum re-notification interval

### `alert_incidents`

Deduplicated incidents using fingerprints.

- `fingerprint` — SHA-256(signal:provider:workspaceOrGlobal)[0:32]
- **Partial unique index** on `(fingerprint) WHERE status IN ('open','acknowledged')` — ensures only one active incident per fingerprint
- `status` — open → acknowledged → resolved | muted
- `occurrence_count` — incremented on each re-evaluation while open

### `alert_deliveries`

Per-channel delivery records.

- `channel` — dashboard | slack | email | webhook
- `status` — pending → sent | failed | skipped
- `destination` — masked (e.g. `https://hostname/***`, `***@domain.com`)
- `last_error` — sanitized, max 200 chars

---

## API

### `GET /api/alerts`

Lists alert incidents. Workspace members see their workspace; superadmins see all.

**Query params:**
| Param | Default | Notes |
|---|---|---|
| `status` | open,acknowledged | `open`, `acknowledged`, `resolved`, `muted`, or `all` |
| `severity` | — | `info`, `warning`, `critical` |
| `signal` | — | any of the 13 signal types |
| `workspace_id` | user's workspace | superadmin only |
| `limit` | 50 | max 200 |

**Response:**

```json
{
  "incidents": [...],
  "counts": { "open": 2, "acknowledged": 1, "critical": 1, "warning": 2 }
}
```

### `PATCH /api/alerts`

**Body:** `{ "id": "<incident-uuid>", "action": "acknowledge" | "resolve" }`

**Response:** `{ "ok": true, "incident_id": "...", "action": "..." }`

---

## Cron Route

`GET /api/cron/alerts` — runs every 5 minutes via Vercel cron.

**Auth:** `Authorization: Bearer $INTERNAL_API_SECRET` or `x-internal-secret` header.

**Response:**

```json
{
  "window_minutes": 15,
  "evaluated": 12,
  "incidents_created": 1,
  "incidents_updated": 3,
  "deliveries_created": 1,
  "external_sent": 0,
  "external_skipped": 1,
  "computed_at": "2026-01-01T00:00:00.000Z"
}
```

---

## Environment Variables

| Variable                             | Where  | Default | Notes                                    |
| ------------------------------------ | ------ | ------- | ---------------------------------------- |
| `VOICEOS_ALERTING_SEND_EXTERNAL`     | Vercel | `false` | Set `true` to enable Slack/email/webhook |
| `VOICEOS_ALERTING_SLACK_WEBHOOK_URL` | Vercel | —       | Slack incoming webhook URL               |
| `VOICEOS_ALERTING_DEFAULT_EMAIL`     | Vercel | —       | Default email for alert delivery         |

`INTERNAL_API_SECRET` (already required) also secures `/api/cron/alerts`.

---

## Security

- External sends are opt-in via `VOICEOS_ALERTING_SEND_EXTERNAL=true`.
- Webhook URLs and email addresses are **masked** before storage (`destination` column).
- `sanitizeAlertMetadata()` strips API keys, tokens, secrets, and Base64-looking long strings from incident metadata before DB insert.
- `last_error` is truncated at 200 chars — no raw stack traces stored.
- Cron route uses `timingSafeEqual` to prevent timing attacks on `INTERNAL_API_SECRET`.

---

## Incident Lifecycle

```
                  ┌─────────────────────────────────────┐
 Signal fires ──→ │  open  │──── ack ────→ acknowledged │
                  └─────────────────────────────────────┘
                       │                      │
                   resolve                 resolve
                       │                      │
                       ▼                      ▼
                    resolved ◄────────────────┘

 Signal clears  → auto-resolved by next cron run
```

---

## Smoke Test

```bash
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  INTERNAL_API_SECRET=... VOICEOS_APP_URL=http://localhost:3000 \
  npx tsx scripts/alerting-smoke-test.ts
```

Runs 12 test scenarios. No real alerts sent regardless of environment. Cleans up all test data.

---

_Last updated: Fase 15 — Alerting + Incident Notifications_
