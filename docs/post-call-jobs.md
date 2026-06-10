# VoiceOS — Post-Call Jobs

`lib/jobs/post-call-jobs.ts` · `lib/jobs/process-post-call-job.ts` · migration 056

Replaces fire-and-forget post-call tasks with a persistent, retryable job queue.

---

## Why This Exists

Previously, after a call ended, the worker ran CRM extraction, webhook delivery, QA analysis, and integration dispatch as inline async operations inside the Close handler. If the worker process died or an external call timed out, those tasks were silently lost.

Now the close handler enqueues rows into `post_call_jobs` (migration 056) and returns. A separate cron route picks them up, processes them, and retries on transient failures.

---

## Jobs

| job_type                 | Priority | What It Does                                                                                                |
| ------------------------ | -------- | ----------------------------------------------------------------------------------------------------------- |
| `crm_extraction`         | 50       | Reads transcript from DB, calls Groq → OpenAI → deterministic blank, writes `extracted_data` to calls table |
| `qa_analysis`            | 80       | Calls `runPostCallQA()`, writes to `qa_evaluations` + `compliance_violations`                               |
| `integration_dispatch`   | 90       | Calls `dispatchPostCallEvents()` — Telegram, Teams, n8n, Google Calendar, custom webhooks                   |
| `outbound_webhook`       | 100      | Signs payload with `VOICEOS_WEBHOOK_SIGNING_SECRET` and POSTs to workspace webhook URL                      |
| `cost_finalization`      | 120      | Verifies/confirms cost_usd after billing; no-op if already finalized                                        |
| `call_summary`           | 130      | Derives summary text from transcript if none exists                                                         |
| `transcript_postprocess` | 150      | Not yet implemented                                                                                         |
| `cleanup`                | 200      | Not yet implemented                                                                                         |

---

## Flow After `call.ended`

```
Worker Close handler
│
├── lifecycle.finalize()
├── upsert calls row
├── backfill call_events
├── release_call_slot        ← concurrent call counter drops
├── emit call.ended
└── void (async () => {
        billing.computeAndPersist()   ← still inline (fast, DB only)
        enqueuePostCallJobsForCall()  ← 3–4 rows inserted, then returns
        emit post_call_jobs.enqueued
    })()

Cron: GET /api/cron/post-call-jobs  (every 1–2 min)
│
├── claim_post_call_jobs(worker_id, limit=10)   ← FOR UPDATE SKIP LOCKED
└── for each job:
      processPostCallJob(job)
      ├── success → markJobCompleted()
      ├── transient error → markJobRetrying() + schedule next run_after
      └── permanent error | max_attempts → markJobFailed() / markJobDeadLetter()
```

---

## Retry & Backoff

| Attempt | Next run_after  |
| ------- | --------------- |
| 1       | +30 seconds     |
| 2       | +2 minutes      |
| 3       | +10 minutes     |
| 4       | +30 minutes     |
| 5+      | → `dead_letter` |

**Transient errors** (retry): network timeout, 5xx, 429, provider unavailable

**Permanent errors** (no retry → failed/dead_letter): HTTP 400, 401, 403, `not_found`, `workspace_not_found`, `call_not_found`

---

## Dead Letter

Jobs that exhaust all retry attempts move to `status = 'dead_letter'` with `failed_at` set. They remain in the table for audit. To manually retry a dead-letter job:

```sql
UPDATE post_call_jobs
SET status = 'pending', attempts = 0, run_after = now(), locked_at = NULL, locked_by = NULL
WHERE id = '<job-uuid>';
```

---

## Running the Cron

### Vercel Cron (recommended)

Add to `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/post-call-jobs", "schedule": "* * * * *" }]
}
```

The cron fires a GET request. Auth is via `INTERNAL_API_SECRET` as `Bearer` token or `x-internal-secret` header.

### Manual trigger

```bash
curl -X GET "https://your-app.vercel.app/api/cron/post-call-jobs?limit=20" \
  -H "Authorization: Bearer $INTERNAL_API_SECRET"
```

### Filter by job type

```bash
curl ".../api/cron/post-call-jobs?limit=10&job_type=outbound_webhook" \
  -H "Authorization: Bearer $INTERNAL_API_SECRET"
```

---

## Required Environment Variables

| Variable                         | Used By                     | Required    |
| -------------------------------- | --------------------------- | ----------- |
| `INTERNAL_API_SECRET`            | Cron auth (min 16 chars)    | Yes         |
| `VOICEOS_WEBHOOK_SIGNING_SECRET` | outbound_webhook signing    | Recommended |
| `GROQ_API_KEY`                   | crm_extraction primary LLM  | Yes         |
| `OPENAI_API_KEY`                 | crm_extraction fallback LLM | Recommended |
| `NEXT_PUBLIC_SUPABASE_URL`       | All DB writes               | Yes         |
| `SUPABASE_SERVICE_ROLE_KEY`      | All DB writes               | Yes         |

---

## Inspecting Jobs

```sql
-- Pending jobs by type
SELECT job_type, COUNT(*) as count
FROM post_call_jobs
WHERE workspace_id = 'YOUR_WS_ID'
  AND status IN ('pending', 'retrying')
GROUP BY job_type;

-- Recent failures
SELECT id, job_type, attempts, error_message, failed_at
FROM post_call_jobs
WHERE workspace_id = 'YOUR_WS_ID'
  AND status IN ('failed', 'dead_letter')
ORDER BY failed_at DESC
LIMIT 20;

-- Jobs for a specific call
SELECT job_type, status, attempts, error_message, completed_at
FROM post_call_jobs
WHERE call_id = 'CALL_UUID'
ORDER BY priority;
```

---

## Manually Retrying a Job

```sql
-- Requeue a specific dead-letter job
UPDATE post_call_jobs
SET status = 'pending', attempts = 0, run_after = now(),
    locked_at = NULL, locked_by = NULL, error_message = NULL
WHERE id = 'JOB_UUID';

-- Requeue all dead-letter jobs for a workspace
UPDATE post_call_jobs
SET status = 'pending', attempts = 0, run_after = now(),
    locked_at = NULL, locked_by = NULL
WHERE workspace_id = 'WS_UUID'
  AND status = 'dead_letter';
```

---

## Known Risks

| Risk                                 | Mitigation                                                               |
| ------------------------------------ | ------------------------------------------------------------------------ |
| Cron not configured                  | Jobs pile up in pending — no data loss, but delivery delayed             |
| Worker dies mid-job                  | Stale lock recovery: jobs locked > 10min become re-claimable             |
| Duplicate processing                 | Each job is atomic via FOR UPDATE SKIP LOCKED — safe                     |
| Webhook URL contains secrets         | URL stored in payload — restrict access via RLS, never log full URL      |
| DB outage during enqueue             | `post_call_jobs.enqueue_failed` event emitted; billing already persisted |
| crm_extraction with empty transcript | Returns deterministic blank — no exception                               |

---

_Last updated: Fase 13 / Post-Call Jobs_
