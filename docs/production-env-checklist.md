# VoiceOS — Production Environment Variables Checklist

All variables below must be set in **Vercel** (Next.js app) and **Render** (agent worker).
Where both columns are marked, the variable must exist in both environments.

| Variable                        | Vercel | Render (worker) | Notes                                                          |
| ------------------------------- | :----: | :-------------: | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      |   ✓    |        ✓        | Supabase project URL                                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` |   ✓    |        —        | Public anon key (safe to expose)                               |
| `SUPABASE_SERVICE_ROLE_KEY`     |   ✓    |        ✓        | Service role — never expose client-side                        |
| `INTERNAL_API_SECRET`           |   ✓    |        ✓        | Min 16 chars, no weak values. Generate: `openssl rand -hex 32` |
| `STRIPE_SECRET_KEY`             |   ✓    |        —        | Stripe secret key (`sk_live_...`)                              |
| `STRIPE_WEBHOOK_SECRET`         |   ✓    |        —        | From Stripe Dashboard → Webhooks                               |
| `STRIPE_PRICE_PRO`              |   ✓    |        —        | Stripe price ID for Pro plan                                   |
| `STRIPE_PRICE_SCALE`            |   ✓    |        —        | Stripe price ID for Scale plan                                 |
| `CARTESIA_API_KEY`              |   —    |        ✓        | Primary TTS. If absent, OpenAI TTS is used                     |
| `OPENAI_API_KEY`                |   —    |        ✓        | TTS fallback + LLM fallback (Fase 9)                           |
| `GROQ_API_KEY`                  |   —    |        ✓        | Primary LLM (llama-4-scout)                                    |
| `DEEPGRAM_API_KEY`              |   —    |        ✓        | STT (nova-2 model)                                             |
| `LIVEKIT_API_KEY`               |   —    |        ✓        | LiveKit project API key                                        |
| `LIVEKIT_API_SECRET`            |   —    |        ✓        | LiveKit project API secret                                     |
| `LIVEKIT_URL`                   |   ✓    |        ✓        | `wss://your-project.livekit.cloud`                             |
| `TWILIO_AUTH_TOKEN`             |   ✓    |        —        | Required for webhook signature validation                      |
| `TWILIO_ACCOUNT_SID`            |   ✓    |        —        | Required for outbound call initiation                          |

### Validation behaviour

`lib/env.ts` runs Zod validation at module load time. Missing or weak values cause:

- **Build failure** if the variable is required and missing at Next.js build time.
- **Runtime crash** at startup if `INTERNAL_API_SECRET` is absent in production
  (`NODE_ENV === "production"`).

### TTS provider selection logic

The worker selects TTS at call start via `createTTSProvider()`:

1. If `CARTESIA_API_KEY` is set → use Cartesia (primary, lower latency).
2. If Cartesia fails **and** `OPENAI_API_KEY` is set → use OpenAI TTS (fallback).
3. If both fail or both keys are absent → call is aborted with `technical_status = failed`.

### INTERNAL_API_SECRET

This secret is used for:

- Securing internal API routes (`/api/qac/webhooks/[token]`, `/api/qac/interactions/[id]/analyze`).
- Signing outbound webhooks (`X-VoiceOS-Signature: sha256=...`).

Rules enforced by `lib/env.ts`:

- Minimum 16 characters.
- Must not be `secret`, `changeme`, `test`, `password`, `internal`, `development`,
  `12345`, or `admin`.
- Required in production; optional in local dev.

### Webhook signing

When a workspace has a `webhook_url` configured (or the room metadata includes one),
VoiceOS will POST `call.completed` payloads to that URL after each call.

The receiver can verify authenticity:

```javascript
const crypto = require("crypto");
const expectedSig = `sha256=${crypto
  .createHmac("sha256", process.env.INTERNAL_API_SECRET)
  .update(rawBody)
  .digest("hex")}`;
// Use timingSafeEqual to prevent timing attacks
const isValid = crypto.timingSafeEqual(
  Buffer.from(req.headers["x-voiceos-signature"]),
  Buffer.from(expectedSig),
);
```

---

_Last updated: Fase 8/9 — TTS Fallback, Circuit Breaker, Analytics & Webhooks_
