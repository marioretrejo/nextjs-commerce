// POST /api/voice/calls/:id/analyze
// Triggers post-call GPT-4-turbo analysis for sentiment, entities, and outcome.
// Can be called manually or wired to the call-ended webhook from the orchestrator.
import { NextRequest } from 'next/server'
import { handleAnalyzeRoute } from '@/lib/voice/post-call-analyzer'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  return handleAnalyzeRoute(req, id)
}
