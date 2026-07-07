// ─── Groq helper ──────────────────────────────────────────────────────────────

const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function groqJSON<T>(
  prompt: string,
  maxTokens = 1024,
  temperature = 0.1,
): Promise<T | null> {
  const key = process.env["GROQ_API_KEY"];
  if (!key) return null;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const raw = data.choices[0]?.message?.content ?? "{}";
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clamp(n: unknown, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
}
