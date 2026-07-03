import { createClient } from "@/lib/supabase/server";
import { groqJson, isLLMConfigured } from "@/lib/groq";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { persona } = (await req.json()) as { persona?: string };

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .single();
  if (!agent)
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const a = agent as Record<string, unknown>;

  // Simulated conversation using the central LLM (Groq → OpenAI fallback)
  if (!isLLMConfigured()) {
    return NextResponse.json({
      transcript: [
        {
          role: "agent",
          text: (a["first_message"] as string) ?? "Hello, how can I help you?",
        },
        {
          role: "prospect",
          text: persona ?? "Tell me more about your service.",
        },
        {
          role: "agent",
          text: "Great question! " + ((a["objective"] as string) ?? ""),
        },
      ],
    });
  }

  const result = await groqJson<{ transcript?: unknown[] }>({
    system: `You are simulating a sales call conversation. The AI agent has this system prompt: "${a["system_prompt"] ?? ""}". First message: "${a["first_message"] ?? ""}". Generate a realistic 6-turn conversation between agent and prospect. Prospect persona: ${persona ?? "interested but skeptical business owner"}. Return only valid JSON of the form {"transcript": [{"role": "agent"|"prospect", "text": string}]}.`,
    prompt: "Generate the simulation.",
    maxTokens: 1024,
  });

  const transcript = Array.isArray(result?.transcript) ? result.transcript : [];
  return NextResponse.json({ transcript });
}
