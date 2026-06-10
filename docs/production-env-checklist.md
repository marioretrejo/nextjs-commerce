# VoiceOS — Production Environment Variables Checklist

All variables below must be set in **Vercel** (Next.js app) and **Render** (agent worker).
Where both columns are marked, the variable must exist in both environments.

| Variable                         | Vercel | Render (worker) | Notes                                                                     |
| -------------------------------- | :----: | :-------------: | ------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`       |   ✓    |        ✓        | Supabase project URL                                                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  |   ✓    |        —        | Public anon key (safe to expose)                                          |
| `SUPABASE_SERVICE_ROLE_KEY`      |   ✓    |        ✓        | Service role — never expose client-side                                   |
| `INTERNAL_API_SECRET`            |   ✓    |        ✓        | Min 16 chars, no weak values. Generate: `openssl rand -hex 32`            |
| `STRIPE_SECRET_KEY`              |   ✓    |        —        | Stripe secret key (`sk_live_...`)                                         |
| `STRIPE_WEBHOOK_SECRET`          |   ✓    |        —        | From Stripe Dashboard → Webhooks                                          |
| `STRIPE_PRICE_PRO`               |   ✓    |        —        | Stripe price ID for Pro plan                                              |
| `STRIPE_PRICE_SCALE`             |   ✓    |        —        | Stripe price ID for Scale plan                                            |
| `CARTESIA_API_KEY`               |   —    |        ✓        | Primary TTS. If absent, OpenAI TTS is used                                |
| `OPENAI_API_KEY`                 |   —    |        ✓        | TTS fallback + LLM fallback. Set to enable Groq→OpenAI failover           |
| `GROQ_API_KEY`                   |   —    |        ✓        | Primary LLM (llama-4-scout-17b). Set for low-latency inference            |
| `VOICEOS_WEBHOOK_SIGNING_SECRET` |   —    |        ✓        | Outbound webhook HMAC key. Min 16 chars. Generate: `openssl rand -hex 32` |
| `DEEPGRAM_API_KEY`               |   —    |        ✓        | STT (nova-2 model)                                                        |
| `LIVEKIT_API_KEY`                |   —    |        ✓        | LiveKit project API key                                                   |
| `LIVEKIT_API_SECRET`             |   —    |        ✓        | LiveKit project API secret                                                |
| `LIVEKIT_URL`                    |   ✓    |        ✓        | `wss://your-project.livekit.cloud`                                        |
| `TWILIO_AUTH_TOKEN`              |   ✓    |        —        | Required for webhook signature validation                                 |
| `TWILIO_ACCOUNT_SID`             |   ✓    |        —        | Required for outbound call initiation                                     |

### Validation behaviour

`lib/env.ts` runs Zod validation at module load time. Missing or weak values cause:

- **Build failure** if the variable is required and missing at Next.js build time.
- **Runtime crash** at startup if `INTERNAL_API_SECRET` is absent in production
  (`NODE_ENV === "production"`).

### LLM provider selection logic (Fase 11)

The worker selects the LLM at call start via `createLLMProvider()` in
`agent/providers/llm-provider-router.ts`:

1. If `GROQ_API_KEY` is set → use Groq (`meta-llama/llama-4-scout-17b-16e-instruct`) as primary.
2. If Groq constructor fails **and** `OPENAI_API_KEY` is set → use OpenAI (`gpt-4o-mini`) as fallback.
3. If both fail or both keys are absent → call is aborted with `technical_status = failed`.

Because `voice.AgentSession.llm` is immutable post-construction, mid-session LLM swap is not
possible. See `docs/voice-runtime-limitations.md` for details.

### TTS provider selection logic

The worker selects TTS at call start via `createTTSProvider()`:

1. If `CARTESIA_API_KEY` is set → use Cartesia (primary, lower latency).
2. If Cartesia fails **and** `OPENAI_API_KEY` is set → use OpenAI TTS (fallback).
3. If both fail or both keys are absent → call is aborted with `technical_status = failed`.

### INTERNAL_API_SECRET

This secret secures internal API routes only:

- `/api/qac/webhooks/[token]`
- `/api/qac/interactions/[id]/analyze`

Rules enforced by `lib/env.ts`:

- Minimum 16 characters.
- Must not be `secret`, `changeme`, `test`, `password`, `internal`, `development`,
  `12345`, or `admin`.
- Required in production; optional in local dev.

### VOICEOS_WEBHOOK_SIGNING_SECRET

Dedicated secret for signing outbound `call.completed` webhook payloads. Kept separate from
`INTERNAL_API_SECRET` so each can be rotated independently.

Rules:

- Minimum 16 characters (same policy as `INTERNAL_API_SECRET`).
- If absent, webhooks are sent **unsigned** — the `X-VoiceOS-Signature` header will read
  `unsigned` instead of a real HMAC. Strongly recommended for production.

### Post-Call Jobs Cron (Fase 13)

The `/api/cron/post-call-jobs` endpoint processes the `post_call_jobs` queue.
Authentication uses the same `INTERNAL_API_SECRET`.

**Already configured in `vercel.json`** — triggers every minute automatically on Vercel Pro/Enterprise:

```json
{ "path": "/api/cron/post-call-jobs", "schedule": "* * * * *" }
```

Additional env vars required by the post-call job processor (**must be set in Vercel, not just Render**):

| Variable                         | Where  | Notes                                           |
| -------------------------------- | ------ | ----------------------------------------------- |
| `GROQ_API_KEY`                   | Vercel | Primary LLM for `crm_extraction` job            |
| `OPENAI_API_KEY`                 | Vercel | Fallback LLM for `crm_extraction` if Groq fails |
| `VOICEOS_WEBHOOK_SIGNING_SECRET` | Vercel | Signs `outbound_webhook` job payloads           |

### Recovery Endpoint (Fase 13)

`GET /api/cron/recover-missing-post-call-jobs` — scans for calls completed in the last N hours
that have **no** `post_call_jobs` rows and re-enqueues the standard job set idempotently.

| Param     | Default | Max | Notes                              |
| --------- | ------- | --- | ---------------------------------- |
| `hours`   | 48      | 168 | Look-back window                   |
| `limit`   | 50      | 200 | Max calls per run                  |
| `dry_run` | —       | —   | Set to `1` to scan without writing |

Auth: same `INTERNAL_API_SECRET` Bearer token or `x-internal-secret` header.

Run manually after incidents or deploy gaps:

```bash
curl -H "Authorization: Bearer $INTERNAL_API_SECRET" \
  "https://your-app.vercel.app/api/cron/recover-missing-post-call-jobs?hours=72&dry_run=1"
```

### Webhook signing

When a workspace has a `webhook_url` configured (or the room metadata includes one),
VoiceOS will POST `call.completed` payloads to that URL after each call.

The receiver can verify authenticity using **replay-protection** signing
(`${timestamp}.${body}` — not body alone):

```javascript
const crypto = require("crypto");
const timestamp = req.headers["x-voiceos-timestamp"];
const sigInput = `${timestamp}.${rawBody}`;
const expectedSig = `sha256=${crypto
  .createHmac("sha256", process.env.VOICEOS_WEBHOOK_SIGNING_SECRET)
  .update(sigInput)
  .digest("hex")}`;
// Use timingSafeEqual to prevent timing attacks
const isValid = crypto.timingSafeEqual(
  Buffer.from(req.headers["x-voiceos-signature"]),
  Buffer.from(expectedSig),
);
// Also reject requests where |Date.now()/1000 - timestamp| > 300 (5 min)
```

---

### Provider Health Cron (Fase 14)

`GET /api/cron/provider-health` — computes per-provider health snapshots from `call_events`
and writes them to `provider_health_checks`. Runs every 5 minutes.

Auth: same `INTERNAL_API_SECRET` or `CRON_SECRET` Bearer token.

**Already configured in `vercel.json`** (`maxDuration = 60`):

```json
{ "path": "/api/cron/provider-health", "schedule": "*/5 * * * *" }
```

Optional env var:

| Variable                                | Default | Notes                                                         |
| --------------------------------------- | ------- | ------------------------------------------------------------- |
| `VOICEOS_PROVIDER_HEALTH_ACTIVE_PROBES` | `false` | Set to `true` to enable external probes (not yet implemented) |

See `docs/provider-health.md` for full documentation.

---

_Last updated: Fase 14 — Provider Health Dashboard + Circuit Breaker Visual_
