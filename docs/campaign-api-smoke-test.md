# Campaign API Smoke Tests

Two complementary smoke test scripts validate the Campaign API at different layers.

---

## Test scripts

| Script                                    | Layer                 | Auth needed | Server needed |
| ----------------------------------------- | --------------------- | ----------- | ------------- |
| `scripts/campaign-smoke-test.ts`          | DB (admin client)     | No          | No            |
| `scripts/campaign-api-http-smoke-test.ts` | HTTP (real endpoints) | Optional    | Yes           |

---

## 1. DB Smoke Test (`campaign-smoke-test.ts`)

Tests Campaign API business logic by calling the same DB operations the routes
use (admin Supabase client), without HTTP or any real telecom provider.

### What it validates

- Configuration sanitization (`sanitizeConfiguration`)
- Phone normalisation via libphonenumber-js (`normalizePhone`)
- Batch deduplication: 2 dup-phone, 2 invalid, 1 dup-lead-id correctly skipped
- DB integrity: no duplicate phones, no duplicate `campaign_lead_id`, no secret keys
- Activation preconditions: `no_contacts`, `no_agent`, `workspace_suspended` all blocked
- Status machine: `completed → active` blocked, all 5 status values covered
- Dispatcher guard: `VOICEOS_LOAD_TEST_MODE=true` → early return, 0 real calls
- Batch idempotency: re-upsert same rows → 0 new DB rows

### How to run

```bash
VOICEOS_LOAD_TEST_MODE=true npx tsx scripts/campaign-smoke-test.ts
```

### Required environment variables

| Variable                    | Purpose                         |
| --------------------------- | ------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`  | Supabase project URL            |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin writes) |
| `VOICEOS_LOAD_TEST_MODE`    | Must be `true`                  |

Set in `.env.local`.

### Expected output

```
40/40 checks passed — ✅ SMOKE TEST PASSED
```

---

## 2. HTTP Smoke Test (`campaign-api-http-smoke-test.ts`)

Tests Campaign API endpoints via real HTTP requests against a running Next.js
server, validating the full stack: auth middleware → route handlers → DB.

### Test tiers

| Tier | Tests                          | Auth needed           |
| ---- | ------------------------------ | --------------------- |
| 0    | Safety guards (env vars)       | No                    |
| 1    | Unauthenticated requests → 401 | No (just server)      |
| 2    | Full CRUD lifecycle            | Yes (`--auth-cookie`) |

### How to run

**Auth-protection tests only** (no cookie needed):

```bash
VOICEOS_LOAD_TEST_MODE=true npx tsx scripts/campaign-api-http-smoke-test.ts \
  --base-url http://localhost:3000
```

**Full lifecycle test** (requires a valid Supabase session cookie):

```bash
VOICEOS_LOAD_TEST_MODE=true npx tsx scripts/campaign-api-http-smoke-test.ts \
  --base-url http://localhost:3000 \
  --workspace-id <WS_ID> \
  --agent-id <AGENT_ID> \
  --auth-cookie "sb-<project>-auth-token=<value>" \
  --cleanup true
```

**Dry-run** (no HTTP calls, validates script logic):

```bash
VOICEOS_LOAD_TEST_MODE=true npx tsx scripts/campaign-api-http-smoke-test.ts \
  --dry-run
```

### Arguments

| Argument         | Default                 | Description                       |
| ---------------- | ----------------------- | --------------------------------- |
| `--base-url`     | `http://localhost:3000` | Next.js server URL                |
| `--workspace-id` | (Super Admin workspace) | Workspace to use for tests        |
| `--agent-id`     | (Ventas Outbound LATAM) | Agent for activation precondition |
| `--auth-cookie`  | (empty)                 | Supabase session cookie string    |
| `--cleanup`      | `true`                  | Delete test campaigns after run   |
| `--dry-run`      | (flag)                  | Print plan, skip HTTP calls       |

### Getting an auth cookie

In your browser, log into the app and copy the `sb-*-auth-token` cookie from
DevTools → Application → Cookies. Pass it as a single quoted string:

```bash
--auth-cookie "sb-blyzfuwwxwpuihrjdpuh-auth-token=base64..."
```

### What Tier 2 validates

1. `POST /api/campaigns` → 201 + campaign id
2. `GET /api/campaigns` → campaign appears in list with `lead_counts`
3. `PATCH` with `http://` webhook_url → 422 (must be https)
4. `PATCH` with `api_key` in configuration → key stripped silently
5. `POST leads/batch` (20 leads) → inserted=15, skipped=5
6. Duplicate batch → inserted=0 (idempotent upsert)
7. `PATCH draft→active` without leads → 422 (precondition)
8. `PATCH draft→active` with 15 leads + agent → 200
9. `PATCH active→completed` → 200
10. `PATCH completed→active` → 422 (illegal transition)
11. `GET /api/campaigns/[id]` → 200 with campaign data

### Auth rejection responses (302 vs 401)

The Next.js middleware intercepts unauthenticated requests and returns a **302
redirect to `/login`** before the route handler is reached. This means REST
clients without a session cookie will see `302`, not `401`. The route handlers
contain their own `401` guard (belt-and-suspenders for cases where the
middleware is bypassed). The HTTP smoke test accepts either `302` or `401` as a
valid auth rejection and uses `redirect: "manual"` in `fetch` to observe the
raw middleware response.

### Limitations

**Cross-workspace isolation** cannot be tested without a second authenticated
user. The protection is enforced by:

- `POST /api/campaigns`: workspace_members RLS check before admin insert
- `GET/PATCH /api/campaigns/[id]`: RLS-scoped user client returns 404 for foreign campaigns
- `POST leads/batch`: ownership verified via RLS before admin write

Unit tests in `agent/tests/campaign-api.test.ts` cover the logic, and Supabase
RLS policies enforce the DB-level isolation.

**`triggerCampaignDispatcher`** is a Next.js Server Action, not an HTTP
endpoint. It cannot be called via `fetch`. In load-test mode it returns early
(verified in the DB smoke test and unit tests).

---

## Safety guarantees

Both scripts enforce:

| Guard                       | Enforcement                                                             |
| --------------------------- | ----------------------------------------------------------------------- |
| No real Twilio calls        | `VOICEOS_LOAD_TEST_MODE=true` → `triggerCampaignDispatcher` exits early |
| No real LiveKit rooms       | Simulator never creates rooms                                           |
| No real LLM/STT/TTS         | Neither script calls any AI provider                                    |
| No real webhooks            | `VOICEOS_LOAD_TEST_SEND_WEBHOOKS` defaults to false/unset               |
| No production contamination | `VOICEOS_ALLOW_PROD_LOAD_TEST` must NOT be `true`                       |

---

## Running the full validation suite

```bash
# 1. DB smoke test (no server needed)
VOICEOS_LOAD_TEST_MODE=true npx tsx scripts/campaign-smoke-test.ts

# 2. HTTP smoke test — auth-protection tier only
pnpm dev &  # start server in background
VOICEOS_LOAD_TEST_MODE=true npx tsx scripts/campaign-api-http-smoke-test.ts \
  --base-url http://localhost:3000
kill %1     # stop dev server

# 3. Full type check
npx tsc --noEmit

# 4. Unit tests (341 total, includes 25 campaign-api tests)
pnpm test:unit

# 5. Worker + app build
pnpm build:worker && pnpm build
```
