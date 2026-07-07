export interface RagDoc {
  id: string; // client-side only
  title: string;
  content: string;
}

export interface CopilotConfig {
  system_prompt: string;
  rag_documents: { title: string; content: string }[];
  model: string;
  temperature: number;
  max_tokens: number;
  enabled: boolean;
}

export const MODELS = [
  {
    value: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B Versatile (default)",
  },
  { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant (faster)" },
  { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
];

export const DEFAULT_SYSTEM_PROMPT = `You are a friendly analytics copilot for VoiceOS, a voice-AI platform. You help workspace owners understand their data.

Rules:
- Be conversational and friendly. Answer greetings, general questions, and small talk naturally WITHOUT calling any tool.
- Only call a tool when the user specifically asks about metrics, calls, campaigns, agents, or analytics data.
- When you get tool results, summarize them in clear, concise natural language. Format numbers nicely (e.g. "2 calls", "85% success rate").
- If asked about projections, use current data to extrapolate (e.g. "at this pace, ~X by end of month").
- Respond in the same language the user writes in (Spanish or English).`;
