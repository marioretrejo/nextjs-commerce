# VoiceOS — Production Readiness

_Branch `claude/voiceos-saas-build-D8nrY`. Every commit below is buildable and
deployed to the Vercel preview. Gate = `pnpm prettier:check && pnpm lint &&
pnpm test:unit && pnpm build` (tsc 0)._

## 1. Status checklist

| Area                              | State | Notes                                                                               |
| --------------------------------- | ----- | ----------------------------------------------------------------------------------- |
| Build / typecheck                 | ✅    | `next build` OK, `tsc --noEmit` 0 errors                                            |
| Lint / format                     | ✅    | ESLint 0 warnings, Prettier clean                                                   |
| Unit tests                        | ✅    | 465 passing (node:test)                                                             |
| CI                                | ✅    | `.github/workflows/ci.yml` (lint+types+tests+build + high-sev audit) green          |
| Security headers                  | ✅    | CSP/HSTS/XFO/nosniff/COOP in `next.config.ts`                                       |
| Dependency audit                  | ✅    | 0 high-severity (Next 15.5.19)                                                      |
| Dialer                            | ✅    | Continuous worker dialer, race-free contact claim (CAS)                             |
| Providers                         | ✅    | Retell + ElevenLabs removed (active); Groq central LLM; OpenAI fallback             |
| Secrets/backdoors                 | ✅    | debug/direct-access routes removed; auth-reason leak closed                         |
| Branch sync w/ main               | ⏳    | White-label/latency merge is a documented blocker (`BLOCKERS.md`) — needs visual QA |
| i18n (Task 2)                     | ⏳    | next-intl configured; full string extraction pending                                |
| TanStack Query (Task 3)           | ⏳    | Not started; 59 pages still `useEffect+fetch`                                       |
| Giant-file decomposition (Task 4) | ⏳    | 8 files >1,000 lines still monolithic                                               |
| Widget web-call UX                | ⚠️    | Rewritten on LiveKit; **needs a live browser call test**                            |

## 2. Environment variables

### Web (Vercel) + Worker (Render) — required

| Var                                                      | Where  | Source                                              |
| -------------------------------------------------------- | ------ | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                               | both   | Supabase project settings → API                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                          | both   | Supabase → API                                      |
| `SUPABASE_SERVICE_ROLE_KEY`                              | both   | Supabase → API (server only)                        |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`            | web    | Stripe dashboard                                    |
| `STRIPE_PRICE_PRO` / `STRIPE_PRICE_SCALE`                | web    | Stripe products                                     |
| `GROQ_API_KEY`                                           | both   | console.groq.com                                    |
| `DEEPGRAM_API_KEY`                                       | worker | Deepgram console                                    |
| `CARTESIA_API_KEY`                                       | worker | Cartesia console                                    |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_URL` | both   | LiveKit Cloud                                       |
| `INTERNAL_API_SECRET`                                    | both   | `openssl rand -hex 32` (same value on web + worker) |
| `CRON_SECRET`                                            | web    | `openssl rand -hex 32`                              |
| `NEXT_PUBLIC_APP_URL`                                    | both   | deployed web URL                                    |

### Optional

`OPENAI_API_KEY` (LLM/TTS fallback), `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`
(optional telephony), `RESEND_API_KEY` (transactional email), `DIRECT_ACCESS_SECRET`
(only if a gated diagnostic is re-added), `VOICEOS_RUN_CAMPAIGN_DIAL=true`
(already set in `render.yaml`).

## 3. Manual steps for the owner (exact commands)

1. **Generate secrets** and set them in Vercel + Render:
   ```bash
   openssl rand -hex 32   # INTERNAL_API_SECRET (same on web + worker)
   openssl rand -hex 32   # CRON_SECRET
   ```
2. **Apply new migrations** (in order) via the Supabase SQL editor or CLI:
   `073_call_recordings_bucket.sql`, `074_deprecate_retell_columns.sql`
   (earlier reconciliation migrations 038/072 already applied on prod).
   ```bash
   supabase db push   # from a machine with the linked project
   ```
3. **Enable HaveIBeenPwned** password checks: Supabase → Authentication →
   Providers → Email → "Prevent use of leaked passwords".
4. **Re-embed knowledge bases** if the gte-small embedding migration is applied
   later (not in this branch): hit `POST /api/knowledge/reembed` per workspace.
5. **Resolve the `main` merge** (branding/white-label) per `reports/BLOCKERS.md`
   with the app running to visually confirm branding + QAC nav.
6. **Smoke-test the LiveKit web widget** in a browser (mic permission → call →
   transcript) before relying on it for demos.

## 4. Remaining debt (prioritized)

1. **P1** — Branch/main merge (branding) — blocked on visual QA (`BLOCKERS.md`).
2. **P2** — i18n extraction (Task 2), TanStack Query migration (Task 3),
   giant-file decomposition (Task 4) — each a dedicated multi-session effort.
3. **P2** — Port main's `worker_core.ts` latency optimizations with a live-call
   test harness.
4. **P3** — Rename `retell_*` / `elevenlabs_*` legacy columns to provider-neutral
   names via a data migration (currently deprecated-in-place).
5. **P3** — Nonce-based CSP to drop `unsafe-inline`/`unsafe-eval`.
