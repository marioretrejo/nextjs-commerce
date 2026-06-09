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

## LLM fallback limitation (Fase 11)

### What is implemented (Fase 11)

**Constructor-level fallback** is active:

- `agent/providers/llm-provider-router.ts` — `createLLMProvider()` tries to instantiate
  Groq as the primary provider (via the OpenAI-compatible API). If the constructor throws
  or `GROQ_API_KEY` is absent **and** `OPENAI_API_KEY` is set, it automatically falls back
  to native OpenAI (`gpt-4o-mini`).
- Both providers use the same `LLM` class from `@livekit/agents-plugin-openai` — Groq is
  accessed via a `baseURL` override pointing to `https://api.groq.com/openai/v1`. No extra
  SDK dependency.
- The `LLMRouterResult` carries `providerName`, `fallbackUsed`, and `reason` so
  `worker_core.ts` can emit the correct `call_events`:
  - `llm.provider_selected` — Groq started successfully
  - `llm.provider_constructor_failed` — both providers failed; call aborted
  - `llm.fallback_selected` + `llm.fallback_succeeded` — OpenAI is active
- `BillingTracker.setLLMProvider()` ensures cost rows use the correct provider field.
- Emergency deterministic responses (`agent/behavior/emergency-responses.ts`) provide
  fast filler phrases when the thinking watchdog fires and no LLM response has arrived.
- CRM extraction (`extractCrmAnalysis`) also follows Groq → OpenAI → deterministic blank
  fallback, emitting `crm.extraction_*` events at each stage.

### What is NOT implemented

**Mid-session (runtime) LLM provider swap is architecturally impossible** with the
current version of the LiveKit Agents SDK (`@livekit/agents ^1.4.4`).

Root cause: `voice.AgentSession` receives the LLM at construction time:

```typescript
const session = new voice.AgentSession({ stt, llm, tts });
//                                              ^^^
// Immutable after construction. There is no .setLLM() or .replaceLLM() method.
```

This means:

| Failure scenario                        | Current behaviour                                                                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Groq constructor fails                  | → OpenAI LLM used for **entire call** ✓                                                                                          |
| Groq key absent                         | → OpenAI LLM used for **entire call** ✓                                                                                          |
| Both providers fail at construction     | → call aborted with `technical_status = failed` ✓                                                                                |
| Groq degrades mid-call (thinking > 3 s) | → `llm.provider_degraded` + emergency filler emitted; `llm.runtime_fallback_unavailable` logged; call continues on same provider |
| Groq down mid-call (thinking > 10 s)    | → `llm.provider_down` emitted; session interrupted to recover turn; provider unchanged                                           |

### Thinking watchdog phases (Fase 11)

| Phase | Threshold | Action                                                                             |
| ----- | --------- | ---------------------------------------------------------------------------------- |
| 1     | 3 s       | Emit `llm.provider_degraded`; say filler via `llm_slow` emergency response         |
| 2     | 6 s       | Emit `llm.runtime_fallback_unavailable` (`reason: mid_session_swap_not_supported`) |
| 3     | 10 s      | Emit `llm.provider_down`; force-interrupt session to recover from silence          |

### Future solutions

1. **LiveKit SDK upgrade** — If a future SDK version supports a `session.replaceLLM()` API,
   the runtime swap can be wired up with minimal changes.

2. **LLM proxy layer** — A transparent HTTP proxy that races requests across providers and
   returns the first valid response. Provider-agnostic; no SDK changes required.

---

_Last updated: Fase 11 — LLM Fallback Router + Emergency Responses_
