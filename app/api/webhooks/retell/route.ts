import { createAdminClient } from '@/lib/supabase/admin';
import { deliverWebhook } from '@/lib/webhooks/deliver';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

interface RetellCallEndedEvent {
  event: string;
  call: {
    call_id: string;
    agent_id: string;
    call_status: string;
    call_type: string;
    start_timestamp: number;
    end_timestamp: number;
    duration_ms: number;
    transcript: string;
    recording_url?: string;
    call_analysis?: {
      call_summary?: string;
      in_voicemail?: boolean;
      user_sentiment?: string;
      call_successful?: boolean;
      custom_analysis_data?: Record<string, unknown>;
    };
    metadata?: Record<string, unknown>;
  };
}

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(`sha256=${expected}`), Buffer.from(signature));
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('x-retell-signature') ?? '';
  const secret = process.env['RETELL_WEBHOOK_SECRET'];

  if (secret) {
    if (!signature) return new NextResponse('Missing signature', { status: 401 });
    const valid = verifySignature(body, signature, secret);
    if (!valid) return new NextResponse('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(body) as RetellCallEndedEvent;
  const admin = createAdminClient();

  if (event.event === 'call_ended' || event.event === 'call_analyzed') {
    const call = event.call;
    const durationSeconds = Math.round((call.duration_ms ?? 0) / 1000);

    // Find agent by retell_agent_id
    const { data: agent } = await admin
      .from('agents')
      .select('id, workspace_id')
      .eq('retell_agent_id', call.agent_id)
      .single();

    if (!agent) {
      console.warn('No agent found for retell_agent_id:', call.agent_id);
      return NextResponse.json({ ok: true });
    }

    const agentRow = agent as { id: string; workspace_id: string };
    const analysis = call.call_analysis;
    const customData = analysis?.custom_analysis_data ?? {};

    let outcome: string | null = null;
    if (analysis?.in_voicemail) outcome = 'voicemail';
    else if (call.call_status === 'error') outcome = 'no_answer';
    else if (analysis?.call_successful) outcome = 'converted';
    else outcome = 'no_answer';

    let sentiment: string | null = null;
    const s = analysis?.user_sentiment?.toLowerCase();
    if (s?.includes('positive')) sentiment = 'positive';
    else if (s?.includes('negative')) sentiment = 'negative';
    else sentiment = 'neutral';

    // Insert call record
    const { data: insertedCall } = await admin.from('calls').insert({
      workspace_id: agentRow.workspace_id,
      agent_id: agentRow.id,
      campaign_id: (call.metadata?.['campaign_id'] as string | null) ?? null,
      contact_name: (call.metadata?.['contact_name'] as string | null) ?? null,
      contact_phone: (call.metadata?.['to_number'] as string | null) ?? null,
      direction: 'outbound',
      duration_seconds: durationSeconds,
      status: call.call_status,
      outcome,
      sentiment,
      transcript: call.transcript,
      recording_url: call.recording_url ?? null,
      summary: analysis?.call_summary ?? null,
      task_completed: analysis?.call_successful ?? false,
      extracted_name: customData['name'] as string | null ?? null,
      extracted_email: customData['email'] as string | null ?? null,
      extracted_interest: customData['interest'] as string | null ?? null,
      extracted_objections: customData['objections'] as string | null ?? null,
      retell_call_id: call.call_id,
      cost_usd: (durationSeconds / 60) * 0.05
    }).select().single();

    // Update campaign contact if applicable
    const campaignId = call.metadata?.['campaign_id'] as string | null;
    const contactId = call.metadata?.['contact_id'] as string | null;
    if (campaignId && contactId) {
      await admin.from('campaign_contacts')
        .update({ status: outcome === 'converted' ? 'converted' : 'no_answer', last_called_at: new Date().toISOString() })
        .eq('id', contactId);
    }

    // Trigger QA scoring async (fire-and-forget)
    if (call.transcript && process.env['ANTHROPIC_API_KEY']) {
      fetch(`${process.env['NEXT_PUBLIC_APP_URL']}/api/qa/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env['INTERNAL_API_SECRET'] ? { 'x-internal-token': process.env['INTERNAL_API_SECRET'] } : {})
        },
        body: JSON.stringify({ retell_call_id: call.call_id, agent_id: agentRow.id, workspace_id: agentRow.workspace_id })
      }).catch(console.error);
    }

    // Deliver outbound webhooks (fire-and-forget)
    const callPayload = {
      call_id: call.call_id,
      agent_id: agentRow.id,
      outcome,
      sentiment,
      duration_seconds: durationSeconds,
      campaign_id: campaignId,
    };
    deliverWebhook(agentRow.workspace_id, 'call.completed', callPayload).catch(console.error);
    if (outcome === 'converted') {
      deliverWebhook(agentRow.workspace_id, 'call.converted', { ...callPayload, contact: insertedCall }).catch(console.error);
    }
  }

  return NextResponse.json({ ok: true });
}
