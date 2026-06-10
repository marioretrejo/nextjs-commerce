# VoiceOS — Controlled Load Testing

Exercises the full post-call pipeline (DB writes, job queuing, cron processing) under
controlled load without incurring any real telephony, LLM, or TTS costs.

---

## How it works

`scripts/load-test-calls.ts` drives `lib/load-test/simulator.ts`, which:

1. **Simulates call lifecycle** at the database layer only — no LiveKit rooms, no Twilio
   calls, no STT/TTS/LLM provider requests.
2. **Writes real rows** to Supabase: `calls`, `call_events`, `call_cost_events`,
   `post_call_jobs`, `dial_eligibility_checks`.
3. **Runs a mock cron** that processes `post_call_jobs` without calling external APIs.
4. **Compiles a metrics report** with pass/fail criteria and saves it to `reports/`.

All simulated calls carry `routing_data.method = 'load_test'` for easy cleanup.

---

## Required environment variables

Set these in `.env.local` before running (not needed for `--dry-run`):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin writes) |

**Never run against a production Supabase project unless you have explicitly set
`VOICEOS_ALLOW_PROD_LOAD_TEST=true`.** The production guard will block the run otherwise.

---

## Running the load test

### Quick smoke test (10 calls, dry-run)

```bash
pnpm load:test -- --workspace-id <id> --agent-id <id> --total 10 --dry-run
```

`--dry-run` skips all DB writes. Use it to verify CLI flags and report formatting
without spending any quota.

### Small run (100 calls, real DB writes)

```bash
pnpm load:test -- \
  --workspace-id <id> \
  --agent-id <id> \
  --total 100 \
  --concurrency 10 \
  --load-test-mode
```

`--load-test-mode` is required for DB writes; it acts as an explicit safety acknowledgement.

### Full load test (1 000 calls)

```bash
pnpm load:test -- \
  --workspace-id <id> \
  --agent-id <id> \
  --total 1000 \
  --concurrency 50 \
  --load-test-mode \
  --post-call-jobs \
  --run-cron
```

Add `--campaign-id <id>` to associate all calls with a specific campaign.

### All CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `--workspace-id <id>` | _(required)_ | Workspace to create calls under |
| `--agent-id <id>` | _(required)_ | Agent ID associated with each call |
| `--campaign-id <id>` | — | Optional campaign to associate calls with |
| `--total <n>` | 100 | Number of calls to simulate |
| `--concurrency <n>` | 10 | Max concurrent simulated calls |
| `--dry-run` | — | Skip all DB writes; pure in-memory simulation |
| `--load-test-mode` | — | Required for DB writes (safety acknowledgement) |
| `--post-call-jobs` | true | Enqueue post-call jobs after each call |
| `--run-cron` | true | Run mock cron processor after all calls complete |
| `--send-webhooks` | false | Enable outbound webhook delivery for jobs |
| `--output-dir <dir>` | `reports` | Directory for JSON + Markdown report files |

You can also set `VOICEOS_LOAD_TEST_MODE=true` as an env var instead of `--load-test-mode`.

---

## Scenario distribution

Each simulated call is assigned one of 9 outcome scenarios using weighted random selection:

| Scenario | Weight | `technical_status` | `business_outcome` | Creates call row? |
|----------|--------|--------------------|--------------------|:-----------------:|
| `completed` | 35% | `completed` | `contacted` | ✓ |
| `voicemail` | 20% | `completed` | `voicemail` | ✓ |
| `no_answer` | 10% | `no_answer` | — | ✓ |
| `silence_timeout` | 10% | `completed` | `silence_timeout` | ✓ |
| `dnc` | 10% | — | — | ✗ (eligibility block) |
| `transferred` | 5% | `completed` | `transferred` | ✓ |
| `transfer_failed` | 5% | `completed` | `error` | ✓ |
| `provider_failure` | 3% | `failed` | — | ✓ |
| `balance_exhausted` | 2% | — | — | ✗ (eligibility block) |

Blocked scenarios (`dnc`, `balance_exhausted`) write a `dial_eligibility_checks` row
with `allowed=false` and do **not** create a `calls` row.

---

## How to avoid real provider costs

The load test is designed so that it is **structurally impossible** to invoke real providers:

- **No Twilio calls** — the simulator inserts directly into Supabase; it never calls
  `twilio.calls.create()` or any Twilio REST endpoint.
- **No LiveKit rooms** — `retell_call_id` is set to a synthetic `lt-…` room name; no
  LiveKit SDK calls are made.
- **No LLM requests** — the mock cron processor (`mockProcessJob`) returns a synthetic
  result for every job type without calling Groq, OpenAI, or any LLM API.
- **No TTS/STT** — Cartesia and Deepgram are never imported or called by the simulator.
- **No outbound webhooks** — `--send-webhooks` defaults to `false`; even when enabled,
  it only calls `fetch(workspaceWebhookUrl)` — there is no Twilio, LiveKit, or AI
  endpoint involved.

---

## Understanding the metrics report

After the run, a formatted report is printed to stdout and saved to
`reports/lt-YYYYMMDD-HHmm.{json,md}`.

### Technical section

| Metric | Meaning |
|--------|---------|
| Calls attempted | Total calls dispatched (including blocked) |
| Calls created (DB) | Calls where a `calls` row was inserted |
| Calls blocked | Eligibility-blocked calls (dnc, balance_exhausted) |
| Calls errored | Calls that threw an unexpected error |
| Peak active calls | Maximum concurrent calls during the run |
| DB insert error rate | Fraction of calls with at least one DB error |
| Close handler p50/p95/p99 | Latency distribution of the per-call close handler |

### Business outcomes section

Counts by scenario type and their share of total attempted calls.

### Post-call jobs section

| Metric | Meaning |
|--------|---------|
| Jobs enqueued | Total post-call job rows inserted |
| Jobs skipped | Idempotent duplicates skipped (ON CONFLICT DO NOTHING) |
| Enqueue rate | Fraction of calls with at least one job enqueued |
| Cron completed | Jobs processed successfully by mock cron |
| Cron dead-letter | Jobs that exhausted all retries |
| Dead-letter rate | `cronDeadLetter / (cronCompleted + cronDeadLetter)` |
| Processed rate | `cronCompleted / (cronCompleted + cronDeadLetter + cronFailed)` |

### Costs section

Synthetic USD costs computed from duration × per-second rate. These are never billed;
they exist to exercise the cost tracking code path end-to-end.

---

## Approval criteria

A load test run is marked **PASSED** only when all 6 criteria are met:

| Criterion | Threshold |
|-----------|-----------|
| DB error rate | < 0.5% |
| All calls have final state | 100% |
| Close handler p95 | < 2 000 ms |
| Close handler p99 | < 5 000 ms |
| Dead-letter rate | < 1% |
| Jobs processed rate | ≥ 99% |

If any criterion fails, the CLI exits with code `1` and the report shows `✗ FAILED`.

---

## Validation SQL

After a real DB run, verify data integrity with these queries:

```sql
-- Calls created in the last hour by load test
SELECT technical_status, business_outcome, COUNT(*)
FROM calls
WHERE routing_data->>'method' = 'load_test'
  AND created_at > now() - interval '1 hour'
GROUP BY technical_status, business_outcome
ORDER BY count DESC;

-- Calls missing post_call_jobs (should be 0 after cron)
SELECT c.id, c.technical_status
FROM calls c
WHERE c.routing_data->>'method' = 'load_test'
  AND c.created_at > now() - interval '1 hour'
  AND NOT EXISTS (
    SELECT 1 FROM post_call_jobs j WHERE j.call_id = c.id
  );

-- Duplicate jobs (should be 0 — idempotent enqueue)
SELECT call_id, job_type, COUNT(*)
FROM post_call_jobs
WHERE created_at > now() - interval '1 hour'
GROUP BY call_id, job_type
HAVING COUNT(*) > 1;

-- Stale running jobs (should be 0 after cron completes)
SELECT COUNT(*) FROM post_call_jobs
WHERE status = 'running'
  AND locked_at < now() - interval '10 minutes';
```

### Cleanup

```sql
-- Remove all load test data
DELETE FROM calls WHERE routing_data->>'method' = 'load_test';
-- (cascades to call_events, call_cost_events, post_call_jobs via FK)
-- dial_eligibility_checks does not FK to calls; clean separately:
DELETE FROM dial_eligibility_checks
WHERE reason LIKE 'Load test:%'
  AND created_at > now() - interval '7 days';
```

---

## Known risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Accidentally targeting production | Production guard blocks unless `VOICEOS_ALLOW_PROD_LOAD_TEST=true` |
| DB quota exhaustion | Each call writes ~5–10 rows; 1 000 calls ≈ 10 000 rows — well within Supabase free tier |
| Foreign key violations | `workspace_id` and `agent_id` must exist in the DB; use real IDs from your workspace |
| Port exhaustion from high concurrency | Keep `--concurrency` ≤ 50 on free-tier Supabase (connection limit ~60) |
| Leftover rows after failed run | Use the cleanup SQL above; all rows are tagged `routing_data.method='load_test'` |

---

## Running the harness tests

The load test simulator ships with a full unit test suite:

```bash
pnpm test:unit
```

Tests cover: production guard, dry-run isolation, scenario distribution, concurrency pool,
call event generation, job enqueue logic, recovery idempotency, metrics computation,
E.164 phone generation, and cost computation. All tests run in-memory with mock Supabase
clients — no real DB or provider calls.

---

_Last updated: Fase 14 — Load Testing Framework_
