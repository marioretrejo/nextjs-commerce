import type { createAdminClient } from "@/lib/supabase/admin";

export interface CopilotConfig {
  system_prompt: string;
  rag_documents: { title: string; content: string }[];
  model: string;
  temperature: number;
  max_tokens: number;
  enabled: boolean;
}

export const FALLBACK_SYSTEM_PROMPT = `You are a friendly analytics copilot for VoiceOS, a voice-AI platform. You help workspace owners understand their data.

Rules:
- Be conversational and friendly. Answer greetings, general questions, and small talk naturally WITHOUT calling any tool.
- Only call a tool when the user specifically asks about metrics, calls, campaigns, agents, or analytics data.
- When you get tool results, summarize them in clear, concise natural language. Format numbers nicely (e.g. "2 calls", "85% success rate").
- If asked about projections, use current data to extrapolate (e.g. "at this pace, ~X by end of month").
- Respond in the same language the user writes in (Spanish or English).`;

export async function loadCopilotConfig(
  admin: ReturnType<typeof createAdminClient>,
): Promise<CopilotConfig> {
  try {
    const { data } = await admin
      .from("copilot_config")
      .select("*")
      .eq("id", "global")
      .single();
    if (data) return data as CopilotConfig;
  } catch {
    /* fall through */
  }
  return {
    system_prompt: FALLBACK_SYSTEM_PROMPT,
    rag_documents: [],
    model: "llama-3.3-70b-versatile",
    temperature: 0.3,
    max_tokens: 1024,
    enabled: true,
  };
}
