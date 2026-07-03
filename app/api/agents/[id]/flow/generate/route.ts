/**
 * POST /api/agents/[id]/flow/generate
 * Generates a ReactFlow config from a natural-language description using the
 * central LLM (Groq → OpenAI fallback).
 */
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { groqJson } from "@/lib/groq";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are an expert conversation flow designer for AI voice agents.
Given a natural-language description of a conversation workflow, you output a valid ReactFlow JSON configuration.

Node types available:
- "start_node": Always exactly one, id must be "start". No target handle. Has source handle "out".
- "ai_state": An AI-driven conversation state. Has target handle "in" and source handle "out". data: { label: "AI State", state_name: string, system_instructions: string }
- "semantic_router": Routes based on detected intent. Has target handle "in" and multiple source handles (one per intent, using intent.id as handle id). data: { label: "Router", description: string, intents: Array<{ id: string, label: string, description: string }> }
- "webhook_node": Calls an external HTTP API. Has target "in" and source "out". data: { label: "Webhook", url: string, method: "POST", extract_variables: string }
- "transfer_node": Transfers the call to a human agent. Has target "in", no source. data: { label: "Transfer", transfer_number: string }
- "end_call_node": Ends the call. Has target "in", no source. data: { label: "End Call", farewell: string }

Edge rules:
- Each edge needs: id (unique string), source (node id), target (node id), sourceHandle (handle id on source), targetHandle (handle id on target, always "in" except start which has no target)
- For semantic_router edges: sourceHandle must match an intent's id
- For all other source nodes: sourceHandle is "out"
- markerEnd: { type: "arrowclosed" }, type: "smoothstep", animated: false
- Include a label on edges from semantic_router (use the intent label)

Layout rules:
- start_node at x:40, y:center
- Nodes flow left to right, spaced ~220px horizontally
- Multiple branches: spread vertically ~160px apart
- Keep positions clean and readable

Output ONLY valid JSON in this exact shape, no markdown, no explanation:
{
  "nodes": [...],
  "edges": [...]
}`;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: agentId } = await params;
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("id", agentId)
    .single();
  if (!agent)
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  let body: { description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const description = body.description?.trim();
  if (!description)
    return NextResponse.json(
      { error: '"description" is required' },
      { status: 400 },
    );
  if (description.length > 2000)
    return NextResponse.json(
      { error: "Description too long (max 2000 chars)" },
      { status: 400 },
    );

  try {
    const flowData = await groqJson<{ nodes?: unknown[]; edges?: unknown[] }>({
      system: SYSTEM_PROMPT,
      prompt: `Generate a complete conversation flow for this voice agent workflow:\n\n${description}\n\nRemember: output ONLY the JSON object with "nodes" and "edges" arrays, nothing else.`,
      maxTokens: 4096,
    });

    if (!flowData) {
      return NextResponse.json(
        { error: "Model did not return valid JSON" },
        { status: 500 },
      );
    }

    if (!Array.isArray(flowData.nodes) || !Array.isArray(flowData.edges)) {
      return NextResponse.json(
        { error: "Invalid flow structure from model" },
        { status: 500 },
      );
    }

    // Ensure start node is present
    const hasStart = flowData.nodes.some(
      (n: unknown) => (n as { id: string }).id === "start",
    );
    if (!hasStart) {
      return NextResponse.json(
        { error: "Generated flow missing start node" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      flow: { version: 2, nodes: flowData.nodes, edges: flowData.edges },
    });
  } catch (err) {
    console.error("generate-flow error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
