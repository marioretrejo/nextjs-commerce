/**
 * POST /api/calls/transfer-whisper
 *
 * Called by the LiveKit worker just before executing a warm transfer.
 * Returns a one-sentence context summary to be injected as the
 * X-VoiceOS-Context SIP header so the receiving agent knows what
 * happened in the call before the transfer.
 *
 * Body: { room_name: string }
 * Returns: { context: string }
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = req.headers.get("x-internal-secret");
  if (secret !== process.env["INTERNAL_API_SECRET"]) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { room_name } = (await req.json()) as { room_name: string };
  if (!room_name)
    return NextResponse.json({ error: "room_name required" }, { status: 400 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("calls")
    .select("transcript, contact_name, contact_phone, agent:agents(name)")
    .eq("retell_call_id", room_name)
    .single();

  if (!data) return NextResponse.json({ context: "Incoming transfer." });

  interface CallData {
    transcript: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    agent: { name: string } | null;
  }
  const call = data as unknown as CallData;

  if (!call.transcript || call.transcript.length < 30) {
    return NextResponse.json({
      context: `Transfer from AI agent${call.agent ? ` (${call.agent.name})` : ""}.`,
    });
  }

  const groqKey = process.env["GROQ_API_KEY"];
  if (!groqKey) {
    return NextResponse.json({
      context: `Transfer from ${call.agent?.name ?? "AI agent"} — see call transcript for details.`,
    });
  }

  const prompt = `Summarize this call in exactly ONE sentence (max 20 words) so a human agent knows context before taking the transfer. Be specific about the caller's need.

Caller: ${call.contact_name ?? call.contact_phone ?? "Unknown"}
Transcript (last 1000 chars):
${call.transcript.slice(-1000)}

Respond with ONLY the one-sentence summary.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 60,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({
      context: `Transfer — ${call.contact_name ?? "caller"} needs assistance.`,
    });
  }

  const llmData = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const context =
    llmData.choices[0]?.message?.content?.trim() ??
    `Transfer from ${call.agent?.name ?? "AI agent"}.`;

  return NextResponse.json({ context });
}
