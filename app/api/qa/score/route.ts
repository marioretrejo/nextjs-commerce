import { createAdminClient } from "@/lib/supabase/admin";
import { groqJson, isLLMConfigured } from "@/lib/groq";
import { NextResponse } from "next/server";

// Internal-only endpoint — called server-to-server after a call completes.
// Secured by requiring a shared internal secret token.
export async function POST(req: Request) {
  const internalToken = req.headers.get("x-internal-token");
  const expectedToken = process.env["INTERNAL_API_SECRET"];

  // Fail closed: this endpoint reads transcripts and writes scores via the
  // service-role client, so it must NEVER be open. If the secret is unset or the
  // token doesn't match, reject. (Previously an unset secret skipped the check
  // entirely, leaving the endpoint fully unauthenticated.)
  if (!expectedToken || internalToken !== expectedToken) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { retell_call_id, agent_id } = (await req.json()) as {
    retell_call_id: string;
    agent_id: string;
    workspace_id: string;
  };

  const admin = createAdminClient();

  const [{ data: callData }, { data: criteria }] = await Promise.all([
    admin
      .from("calls")
      .select("transcript, id, workspace_id")
      .eq("retell_call_id", retell_call_id)
      .single(),
    admin.from("qa_criteria").select("*").eq("agent_id", agent_id),
  ]);

  const call = callData as {
    transcript: string | null;
    id: string;
    workspace_id: string;
  } | null;
  if (!call?.transcript || !criteria?.length)
    return NextResponse.json({ ok: true });

  // Tenant-integrity check: the call and the agent's criteria must belong to the
  // same workspace, so a caller can't score one tenant's call against another's.
  const { data: agentRow } = await admin
    .from("agents")
    .select("workspace_id")
    .eq("id", agent_id)
    .single();
  const agentWs = (agentRow as { workspace_id: string } | null)?.workspace_id;
  if (!agentWs || agentWs !== call.workspace_id) {
    return NextResponse.json({ error: "workspace mismatch" }, { status: 403 });
  }

  if (!isLLMConfigured()) return NextResponse.json({ ok: true });

  try {
    const criteriaList = (
      criteria as { name: string; description: string | null; weight: number }[]
    )
      .map((c) => `- ${c.name} (weight ${c.weight}/10): ${c.description ?? ""}`)
      .join("\n");

    const result = await groqJson<{ overall?: number }>({
      system:
        'You are a call quality analyst. Score the call transcript against the criteria. Return only valid JSON: {"overall": number 0-100, "scores": [{"name": string, "score": number 0-100}]}',
      prompt: `Criteria:\n${criteriaList}\n\nTranscript:\n${call.transcript.slice(0, 4000)}\n\nScore this call.`,
      maxTokens: 512,
    });

    if (!result) {
      console.error("QA: LLM scoring returned no result");
      return NextResponse.json({ ok: true, scored: false });
    }

    if (typeof result.overall === "number") {
      await admin
        .from("calls")
        .update({ qa_score: result.overall })
        .eq("id", call.id);
    }
  } catch (e) {
    console.error("QA scoring failed:", e);
  }

  return NextResponse.json({ ok: true });
}
