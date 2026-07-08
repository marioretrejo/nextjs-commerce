export type CallDisposition =
  | "meeting_booked"
  | "not_interested"
  | "voicemail"
  | "follow_up"
  | "callback_requested"
  | "completed"
  | "transferred"
  | "other";

export interface AnalysisResult {
  summary: string[];
  sentiment: "positive" | "neutral" | "negative";
  disposition: CallDisposition;
  intent: string;
  extracted_name: string | null;
  extracted_email: string | null;
  extracted_interest: string | null;
  extracted_objections: string | null;
  extracted_data: Record<string, unknown> | null;
}

export type AnalysisResponse = AnalysisResult & { _tokensUsed: number | null };

const VALID_DISPOSITIONS = new Set<CallDisposition>([
  "meeting_booked",
  "not_interested",
  "voicemail",
  "follow_up",
  "callback_requested",
  "completed",
  "transferred",
  "other",
]);

const EXTRACTION_PROMPT = `You are a call analysis expert. Analyze the following voice call transcript and return a JSON object with EXACTLY these fields:

- "summary": array of exactly 3 strings, each a bullet point summarizing a key moment (≤15 words each)
- "sentiment": exactly one of "positive", "neutral", or "negative" — the user's overall emotional tone
- "disposition": the AI-extracted sales/call outcome — MUST be exactly one of:
    "meeting_booked"     → prospect agreed to a meeting or appointment
    "not_interested"     → prospect declined or showed clear disinterest
    "voicemail"          → reached voicemail or an automated answering system
    "follow_up"          → conversation ended but a follow-up is needed
    "callback_requested" → caller explicitly asked to be called back later
    "completed"          → goal achieved without a more specific categorical outcome
    "transferred"        → call was handed off to a human agent
    "other"              → none of the above categories apply
- "intent": the user's primary objective or reason for calling, in ≤10 words
- "extracted_name": the user's full name if explicitly stated, otherwise null
- "extracted_email": the user's email address if mentioned, otherwise null
- "extracted_interest": the main product, service, or topic the user showed interest in, otherwise null
- "extracted_objections": the main objection, concern, or hesitation the user raised, otherwise null
- "extracted_data": a JSON object with any additional structured data mentioned in the call, including:
    - "budget": dollar amount or budget range mentioned, otherwise null
    - "meeting_date": specific date or time mentioned for a meeting (ISO-8601 if possible), otherwise null
    - "company": company name if mentioned, otherwise null
    - "phone": alternative phone number mentioned, otherwise null
    - Any other key facts worth capturing as key-value pairs

Respond with ONLY the raw JSON object — no markdown, no code fences, no explanation.

TRANSCRIPT:
`;

export async function runGroqAnalysis(
  transcript: string,
): Promise<AnalysisResponse | null> {
  const groqKey = process.env["GROQ_API_KEY"];
  if (!groqKey) return null;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        { role: "user", content: `${EXTRACTION_PROMPT}${transcript}` },
      ],
      temperature: 0.1,
      max_tokens: 768,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage?: { total_tokens?: number };
  };

  try {
    const result = JSON.parse(
      data.choices[0]?.message?.content ?? "{}",
    ) as AnalysisResult;
    if (!VALID_DISPOSITIONS.has(result.disposition))
      result.disposition = "other";
    if (result.extracted_data && typeof result.extracted_data !== "object")
      result.extracted_data = null;
    return { ...result, _tokensUsed: data.usage?.total_tokens ?? null };
  } catch {
    return null;
  }
}
