/**
 * POST /api/workflow/generate
 *
 * Takes a plain-language description and returns a React Flow–compatible
 * graph (nodes + edges) via OpenAI Structured Outputs.
 *
 * The JSON schema is passed as a strict response_format so the model is
 * guaranteed to return valid, parseable graph data.
 */
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const GRAPH_SCHEMA = {
  type: 'object' as const,
  properties: {
    nodes: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          id:       { type: 'string' as const },
          type:     { type: 'string' as const, enum: ['greeting', 'message', 'condition', 'api_call', 'transfer', 'end'] },
          position: {
            type: 'object' as const,
            properties: {
              x: { type: 'number' as const },
              y: { type: 'number' as const },
            },
            required: ['x', 'y'],
            additionalProperties: false,
          },
          data: {
            type: 'object' as const,
            properties: {
              label:       { type: 'string' as const },
              text:        { type: 'string' as const },
              condition:   { type: 'string' as const },
              url:         { type: 'string' as const },
              method:      { type: 'string' as const, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
              phoneNumber: { type: 'string' as const },
            },
            required: ['label'],
            additionalProperties: false,
          },
        },
        required: ['id', 'type', 'position', 'data'],
        additionalProperties: false,
      },
    },
    edges: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          id:       { type: 'string' as const },
          source:   { type: 'string' as const },
          target:   { type: 'string' as const },
          label:    { type: 'string' as const },
          animated: { type: 'boolean' as const },
        },
        required: ['id', 'source', 'target'],
        additionalProperties: false,
      },
    },
  },
  required: ['nodes', 'edges'],
  additionalProperties: false,
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env['OPENAI_API_KEY']) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 503 });
  }

  const { prompt } = await req.json() as { prompt?: string };
  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a voice agent workflow designer. Given a description, generate a React Flow graph.

Node types:
- greeting   : First node, welcome message
- message    : Agent says something (text field)
- condition  : Branch point (condition field describes the if/else)
- api_call   : External HTTP call (url + method fields)
- transfer   : Transfer to human/number (phoneNumber field)
- end        : Call ends

Rules:
- Always start with exactly one 'greeting' node at position {x:300, y:50}
- Lay nodes top-to-bottom with y spacing ~150px, x spacing ~300px for branches
- Every non-end node must connect to at least one other node
- Conditions should have two outgoing edges labelled "Yes" and "No" (or similar)
- IDs: use short strings like "n1", "n2", "e1", "e2"
- Set animated:true on all edges
- Keep text concise (1–2 sentences max per node)`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'workflow_graph',
        strict: true,
        schema: GRAPH_SCHEMA,
      },
    },
    max_tokens: 2048,
  });

  const raw = response.choices[0]?.message.content ?? '{}';
  try {
    const graph = JSON.parse(raw) as { nodes: unknown[]; edges: unknown[] };
    return NextResponse.json(graph);
  } catch {
    return NextResponse.json({ error: 'Failed to parse generated workflow' }, { status: 500 });
  }
}
