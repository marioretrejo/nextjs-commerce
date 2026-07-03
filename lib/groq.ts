/**
 * Central Groq LLM client for all non-voice reasoning tasks (QA scoring, flow
 * generation, scorecards, simulations, guardrail audits, test-suite judging).
 *
 * Policy: Groq is primary. On failure or invalid JSON we retry, then fall back
 * to a secondary Groq model, and finally to OpenAI (gpt-4o-mini) when
 * OPENAI_API_KEY is configured — matching the worker's approved provider
 * fallback chain. Never throws; callers get a value or null.
 */
import Groq from "groq-sdk";

// Real Groq model IDs (same family the voice worker uses).
export const GROQ_PRIMARY_MODEL = "llama-3.3-70b-versatile";
export const GROQ_SECONDARY_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const OPENAI_FALLBACK_MODEL = "gpt-4o-mini";

let _client: Groq | null = null;
function client(): Groq | null {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) return null;
  if (!_client) _client = new Groq({ apiKey });
  return _client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface GroqCallOptions {
  system?: string;
  prompt: string;
  /** Override the primary model. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

async function groqChat(
  opts: GroqCallOptions & { jsonMode: boolean },
  model: string,
): Promise<string | null> {
  const c = client();
  if (!c) return null;
  const messages: { role: "system" | "user"; content: string }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });

  const completion = await c.chat.completions.create({
    model,
    messages,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.4,
    ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
  });
  return completion.choices[0]?.message?.content ?? null;
}

/**
 * OpenAI fallback (only used when Groq is fully unavailable). Uses the OpenAI
 * REST API directly to avoid coupling to a specific SDK surface.
 */
async function openaiChat(
  opts: GroqCallOptions & { jsonMode: boolean },
): Promise<string | null> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) return null;
  const messages: { role: "system" | "user"; content: string }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_FALLBACK_MODEL,
      messages,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.4,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? null;
}

/**
 * Free-text completion. Groq primary → secondary → OpenAI. Returns null if all
 * providers fail.
 */
export async function groqText(opts: GroqCallOptions): Promise<string | null> {
  const attempts: (() => Promise<string | null>)[] = [
    () =>
      groqChat({ ...opts, jsonMode: false }, opts.model ?? GROQ_PRIMARY_MODEL),
    () => groqChat({ ...opts, jsonMode: false }, GROQ_SECONDARY_MODEL),
    () => openaiChat({ ...opts, jsonMode: false }),
  ];
  for (let i = 0; i < attempts.length; i++) {
    try {
      const out = await attempts[i]!();
      if (out) return out;
    } catch (err) {
      console.error(`[groq] text attempt ${i} failed:`, (err as Error).message);
    }
    if (i < attempts.length - 1) await sleep(300 * (i + 1));
  }
  return null;
}

/**
 * JSON completion with schema-agnostic validation. Forces json_object mode,
 * retries the primary model up to 3× (parse failures included), then falls
 * back to the secondary Groq model and finally OpenAI. Returns the parsed
 * object or null.
 */
export async function groqJson<T>(opts: GroqCallOptions): Promise<T | null> {
  const primary = opts.model ?? GROQ_PRIMARY_MODEL;
  const providers: (() => Promise<string | null>)[] = [
    () => groqChat({ ...opts, jsonMode: true }, primary),
    () => groqChat({ ...opts, jsonMode: true }, primary),
    () => groqChat({ ...opts, jsonMode: true }, primary),
    () => groqChat({ ...opts, jsonMode: true }, GROQ_SECONDARY_MODEL),
    () => openaiChat({ ...opts, jsonMode: true }),
  ];

  for (let i = 0; i < providers.length; i++) {
    try {
      const raw = await providers[i]!();
      if (raw) {
        try {
          return JSON.parse(raw) as T;
        } catch {
          console.error(`[groq] json attempt ${i}: invalid JSON`);
        }
      }
    } catch (err) {
      console.error(`[groq] json attempt ${i} failed:`, (err as Error).message);
    }
    if (i < providers.length - 1) await sleep(300 * (i + 1));
  }
  return null;
}

/** True when at least one LLM provider (Groq or OpenAI fallback) is configured. */
export function isLLMConfigured(): boolean {
  return Boolean(process.env["GROQ_API_KEY"] || process.env["OPENAI_API_KEY"]);
}
