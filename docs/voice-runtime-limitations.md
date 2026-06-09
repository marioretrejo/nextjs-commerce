# VoiceOS Voice Runtime — Known Limitations

## Runtime TTS fallback limitation

### What is implemented (Fase 8)

**Constructor-level fallback** is active:

- `agent/providers/tts-provider-router.ts` — `createTTSProvider()` tries to instantiate
  Cartesia TTS first. If the constructor throws (missing API key, SDK error, etc.) **and**
  `OPENAI_API_KEY` is set, it automatically falls back to `OpenAITTS` from
  `@livekit/agents-plugin-openai`.
- The `TTSRouterResult` carries `providerName`, `fallbackUsed`, and `reason` so
  `worker_core.ts` can emit the correct `call_events`:
  - `tts.provider_selected` — Cartesia started successfully
  - `tts.fallback_selected` + `tts.provider_constructor_failed` — OpenAI is active
- `BillingTracker.setTTSProvider()` ensures the cost row in `call_cost_events` uses the
  correct provider field (`cartesia` vs `openai`).

### What is NOT implemented

**Mid-session (runtime) TTS provider swap is architecturally impossible** with the
current version of the LiveKit Agents SDK (`@livekit/agents ^1.4.4`).

Root cause: `voice.AgentSession` receives the TTS provider at construction time:

```typescript
const session = new voice.AgentSession({ stt, llm: tts });
//                                                    ^^^
// Immutable after construction. There is no .setTTS() or .replaceTTS() method.
```

This means:

| Failure scenario                                                | Current behaviour                                                                                                                   |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Cartesia constructor fails                                      | → OpenAI TTS used for **entire call** ✓                                                                                             |
| Cartesia works initially, then degrades mid-call (TTFB > 2.5 s) | → `tts.provider_degraded` emitted, `tts.fallback_unavailable` logged. Call continues on the original (degraded) provider.           |
| Cartesia goes fully silent mid-call (TTFB > 4 s)                | → `tts.provider_down` emitted, `session.interrupt({force: true})` recovers the turn. Call continues but provider is still Cartesia. |

### Operational impact

- If Cartesia suffers a partial outage after calls are connected, agents will experience
  increased silence at turn boundaries. The TTFB watchdog will detect and log this, but
  cannot automatically switch the provider.
- The 60-second balance-checker interval and the TTFB phase-3 interrupt prevent infinite
  silences. The agent will recover to `listening` state.

### Future solutions

1. **LiveKit SDK upgrade** — If a future SDK version supports per-turn provider switching
   or a `session.replaceTTS()` API, the runtime swap can be wired up in
   `agent/worker_core.ts` with minimal changes (the `tts-provider-router.ts` already has
   the `TTSProviderName` type and state scaffolding).

2. **TTS proxy layer** — A transparent HTTP proxy in front of Cartesia that can redirect
   synthesis requests to OpenAI when Cartesia responds slowly. This is provider-agnostic
   and does not require SDK changes. Complexity: medium.

3. **Per-turn provider routing** — Spawn a new session per turn (expensive) or use a
   custom TTS adapter that wraps both providers and races requests. Complexity: high.

---

## LLM fallback limitation (Fase 9 — not yet implemented)

LLM fallback (Groq → OpenAI) is planned for Fase 9. As of Fase 8:

- Groq is the only LLM provider.
- If Groq returns 401/429 or times out, the session will stall in `thinking` state.
- The thinking watchdog (phases 1–3) will detect the stall and inject a filler phrase,
  then interrupt after 10 seconds.

---

_Last updated: Fase 8 — TTS Fallback Router + Financial Circuit Breaker_
