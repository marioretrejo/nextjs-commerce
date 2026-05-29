/**
 * VoiceOS Distributed Tracing & Latency Logger
 *
 * Structured JSON logs consumable by any log aggregator (Datadog, Logtail,
 * Axiom, Sentry, etc.) without requiring a specific SDK at runtime.
 *
 * Usage — worker:
 *   const span = startSpan('stt');
 *   // ... await stt result ...
 *   endSpan(span, { transcript_length: text.length });
 *
 * Usage — API routes:
 *   const t = traceRequest(req, 'livekit.token');
 *   // ... work ...
 *   t.end({ workspace_id, agent_id });
 *
 * To forward logs to Sentry:
 *   1. npm install @sentry/nextjs
 *   2. Add SENTRY_DSN to .env.local
 *   3. Uncomment the Sentry block below
 *
 * To forward logs to PostHog:
 *   1. npm install posthog-node
 *   2. Add POSTHOG_API_KEY to .env.local
 *   3. Use captureEvent() in the endSpan handler
 */

export type SpanName =
  | 'stt'             // Speech-to-text transcription
  | 'llm.first_token' // Time to first LLM token (TTFT)
  | 'llm.full'        // Full LLM response time
  | 'tts.first_chunk' // Time to first TTS audio chunk
  | 'tts.full'        // Full TTS synthesis
  | 'tool'            // Tool / function call execution
  | 'token.issue'     // LiveKit token issuance
  | 'call.total';     // End-to-end call duration

export interface Span {
  name: SpanName | string;
  traceId: string;
  startedAt: number; // Date.now()
  startedHr: bigint; // process.hrtime.bigint() for sub-ms precision
  meta: Record<string, unknown>;
}

export interface SpanResult extends Span {
  durationMs: number;
  endedAt: number;
}

let _traceIdCounter = 0;
function newTraceId(): string {
  return `vop-${Date.now().toString(36)}-${(++_traceIdCounter).toString(36)}`;
}

export function startSpan(
  name: SpanName | string,
  meta: Record<string, unknown> = {}
): Span {
  return {
    name,
    traceId: newTraceId(),
    startedAt: Date.now(),
    startedHr: process.hrtime.bigint(),
    meta,
  };
}

export function endSpan(
  span: Span,
  extra: Record<string, unknown> = {}
): SpanResult {
  const durationMs = Number(process.hrtime.bigint() - span.startedHr) / 1_000_000;
  const result: SpanResult = {
    ...span,
    meta: { ...span.meta, ...extra },
    durationMs: Math.round(durationMs * 100) / 100,
    endedAt: Date.now(),
  };

  log('trace', result as unknown as Record<string, unknown>);
  return result;
}

// ─── Request-level tracing (API routes) ──────────────────────────────────────

export function traceRequest(req: Request, operation: string) {
  const span = startSpan(operation, {
    method: req.method,
    path: new URL(req.url).pathname,
  });
  return {
    end: (extra: Record<string, unknown> = {}) => endSpan(span, extra),
    span,
  };
}

// ─── Pipeline stage helpers (worker) ─────────────────────────────────────────

/** Wraps an async pipeline stage with automatic timing. */
export async function timed<T>(
  name: SpanName | string,
  fn: () => Promise<T>,
  meta: Record<string, unknown> = {}
): Promise<T> {
  const span = startSpan(name, meta);
  try {
    const result = await fn();
    endSpan(span, { ok: true });
    return result;
  } catch (err) {
    endSpan(span, { ok: false, error: String(err) });
    throw err;
  }
}

// ─── Core logger ─────────────────────────────────────────────────────────────

type LogLevel = 'info' | 'warn' | 'error' | 'trace';

export function log(level: LogLevel, data: Record<string, unknown> | string): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: 'voiceos',
    ...(typeof data === 'string' ? { message: data } : data),
  };

  // Single JSON line — trivially parseable by any log aggregator
  const line = JSON.stringify(entry);

  if (level === 'error') {
    console.error(line);
    // TODO: forward to Sentry — uncomment after adding @sentry/nextjs:
    // import * as Sentry from '@sentry/nextjs';
    // Sentry.captureMessage(line, 'error');
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

// ─── P95 / P99 latency guard (dev warning) ───────────────────────────────────
// Logs a warning if a stage exceeds the expected p95 threshold.

const P95_THRESHOLDS_MS: Partial<Record<SpanName, number>> = {
  'stt':             800,   // Deepgram nova-3 should respond in < 800ms
  'llm.first_token': 600,   // Groq Llama 4 Scout TTFT < 600ms
  'tts.first_chunk': 400,   // Cartesia sonic-3 < 400ms
  'tool':           5000,   // Tools have 8s timeout; warn at 5s
};

export function checkLatencyThreshold(result: SpanResult): void {
  const threshold = P95_THRESHOLDS_MS[result.name as SpanName];
  if (threshold && result.durationMs > threshold) {
    log('warn', {
      message: `Latency threshold exceeded for stage "${result.name}"`,
      stage: result.name,
      durationMs: result.durationMs,
      thresholdMs: threshold,
      traceId: result.traceId,
    });
  }
}
