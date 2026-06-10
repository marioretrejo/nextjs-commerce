# Provider Health Dashboard

VoiceOS derives provider health from call event telemetry already captured in `call_events`. No active probes are made by default — health is 100% derived from observed event data.

---

## Architecture

```
call_events (existing)
        │
        ▼
cron: /api/cron/provider-health  (every 5 min)
        │  computeProviderHealthFromEvents()
        ▼
provider_health_checks (Migration 060)
        │
        ▼
GET /api/provider-health  →  Admin UI  /  Workspace UI
```

---

## Monitored Providers

| Provider         | Type      | Events Used                                                                                      |
| ---------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `groq`           | llm       | `llm.provider_selected`, `llm.provider_down`, `llm.slow`, `llm.timeout`, `llm.provider_degraded` |
| `openai`         | llm / tts | `llm.fallback_succeeded`, `tts.provider_selected`                                                |
| `cartesia`       | tts       | `tts.provider_selected`, `tts.provider_down`, `tts.first_audio_slow`                             |
| `deepgram`       | stt       | `stt.provider_selected`, `stt.provider_error`, `stt.provider_down`                               |
| `livekit`        | realtime  | reserved (not yet emitting health events)                                                        |
| `twilio`         | telephony | `telephony.provider_selected`, `telephony.sip_participant_failed`                                |
| `supabase`       | database  | `billing.circuit_breaker_triggered`, `billing.preflight_failed`                                  |
| `webhook`        | webhook   | `webhook.sent`, `webhook.failed`                                                                 |
| `post_call_jobs` | jobs      | `post_call_jobs.completed`, `post_call_jobs.failed`, `post_call_jobs.dead_letter`                |

---

## Health Thresholds

| Metric                | Degraded               | Down     |
| --------------------- | ---------------------- | -------- |
| Error rate            | ≥ 10%                  | ≥ 40%    |
| P95 latency           | ≥ 2000ms               | ≥ 5000ms |
| Fallback count        | ≥ 1                    | —        |
| Inferred circuit open | error_rate ≥ 50%       | —        |
| Minimum sample        | < 3 events → `unknown` | —        |

---

## Circuit State (Inferred)

Circuit state is **inferred from error rate patterns** — it is NOT a real circuit breaker state machine. It is a UI heuristic only.

| State       | Meaning                                           |
| ----------- | ------------------------------------------------- |
| `closed`    | Normal operation (error rate < 10%)               |
| `half_open` | Elevated errors, recovering (10–49%)              |
| `open`      | Provider failing, fallbacks likely active (≥ 50%) |
| `disabled`  | Not in use (static configuration)                 |
| `unknown`   | Insufficient sample data                          |

---

## API

### `GET /api/provider-health`

Auth: session cookie required. Superadmins receive global health; regular users receive their workspace health.

**Query params:**

| Param            | Values                | Default         |
| ---------------- | --------------------- | --------------- |
| `window_minutes` | 5 \| 15 \| 60 \| 1440 | 15              |
| `workspace_id`   | UUID                  | (auto-resolved) |
| `provider`       | provider name filter  | —               |
| `provider_type`  | type filter           | —               |

**Response:**

```json
{
  "window_minutes": 15,
  "workspace_id": null,
  "is_global": true,
  "generated_at": "2025-01-01T00:00:00Z",
  "summary": [...],
  "incidents": [...],
  "jobs": { "pending": 0, "running": 0, "retrying": 0, "dead_letter": 0, "failed": 0, "stale_running": 0 },
  "webhooks": { "sent": 10, "failed": 0, "retrying": 0, "pending": 0 },
  "timeline": [...]
}
```

### `GET /api/cron/provider-health`

Auth: `Authorization: Bearer <INTERNAL_API_SECRET>` or `x-internal-secret: <secret>`. Timing-safe comparison.

Computes and stores a global health snapshot. Called every 5 minutes by Vercel cron.

**Query params:**

- `window_minutes` — 5 | 15 (default 5)

---

## Database

### Table: `provider_health_checks` (Migration 060)

| Column               | Type            | Notes                                                                                           |
| -------------------- | --------------- | ----------------------------------------------------------------------------------------------- |
| `id`                 | uuid            | PK                                                                                              |
| `workspace_id`       | uuid \| null    | NULL = global platform health                                                                   |
| `provider`           | text            | e.g. `groq`, `cartesia`                                                                         |
| `provider_type`      | text            | `llm`, `tts`, `stt`, `telephony`, `database`, `webhook`, `jobs`, `cron`, `realtime`, `internal` |
| `status`             | text            | `healthy`, `degraded`, `down`, `unknown`                                                        |
| `latency_ms`         | integer \| null | P95 latency stored                                                                              |
| `error_rate`         | numeric(7,4)    | 0.0–1.0                                                                                         |
| `success_rate`       | numeric(7,4)    | 0.0–1.0                                                                                         |
| `sample_size`        | integer         | Events in window                                                                                |
| `window_seconds`     | integer         | Computation window                                                                              |
| `circuit_state`      | text            | `closed`, `half_open`, `open`, `disabled`, `unknown`                                            |
| `fallback_provider`  | text \| null    | Provider that handled fallback                                                                  |
| `fallback_count`     | integer         | Fallback events in window                                                                       |
| `last_error_code`    | text \| null    | Sanitized error code                                                                            |
| `last_error_message` | text \| null    | Sanitized, truncated to 200 chars                                                               |
| `checked_at`         | timestamptz     | Snapshot timestamp                                                                              |

### RPC: `get_provider_health_summary(p_workspace_id, p_window_minutes)`

Returns the most recent snapshot per provider for the given workspace and window.

---

## Security

- `last_error_message` is scrubbed by `sanitizeProviderError()` before storage — Bearer tokens, API keys, secrets, 40+ char strings are all replaced with `[REDACTED]`.
- Timeline payload fields matching `api_key`, `token`, `secret`, `password`, `authorization`, `bearer`, `key`, `credential` are stripped entirely.
- `workspace_id` override in `/api/provider-health` requires `is_superadmin = true`.
- RLS on `provider_health_checks`: superadmins see all rows; workspace members see their workspace rows only.
- Cron route requires `INTERNAL_API_SECRET` or `CRON_SECRET` (min 16 chars, timing-safe).
- No active external probes by default (`VOICEOS_PROVIDER_HEALTH_ACTIVE_PROBES=true` is reserved but not implemented).

---

## UI Pages

| Path                    | Audience                                 |
| ----------------------- | ---------------------------------------- |
| `/admin/infrastructure` | Superadmin — global platform health tab  |
| `/provider-health`      | Workspace members — per-workspace health |

---

## Environment Variables

| Variable                                | Required | Purpose                                                     |
| --------------------------------------- | -------- | ----------------------------------------------------------- |
| `INTERNAL_API_SECRET`                   | Yes      | Authenticates cron route                                    |
| `CRON_SECRET`                           | Fallback | Used if `INTERNAL_API_SECRET` not set                       |
| `VOICEOS_PROVIDER_HEALTH_ACTIVE_PROBES` | No       | Set to `true` to enable active probes (not yet implemented) |

---

## Vercel Cron

```json
{
  "path": "/api/cron/provider-health",
  "schedule": "*/5 * * * *"
}
```

`maxDuration = 60` seconds.

---

## Post-Call Jobs Health

In addition to event-derived health, the cron also queries `post_call_jobs` directly to report:

- `pending` / `running` / `retrying` / `dead_letter` / `failed` — current job queue state
- `stale_running` — jobs stuck in `running` for > 10 minutes (`locked_at` threshold)

A job is considered stale if `locked_at < now() - 10 min`. This indicates a crashed worker or lock never released.
