import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    company: string;
    volume: string;
    countries?: string;
    phone_system?: string;
    message?: string;
  };

  if (!body.company?.trim() || !body.volume) {
    return NextResponse.json({ error: 'company and volume are required' }, { status: 400 });
  }

  const VOLUME_LABELS: Record<string, string> = {
    lt_1k: 'Less than 1,000/month',
    '1k_10k': '1,000 – 10,000/month',
    '10k_50k': '10,000 – 50,000/month',
    '50k_100k': '50,000 – 100,000/month',
    gt_100k: 'More than 100,000/month',
  };

  const adminClient = (await import('@/lib/supabase/admin')).createAdminClient();

  // Log the inquiry in workspace_events for superadmin visibility
  const { data: workspaceRow } = await adminClient
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (workspaceRow) {
    await adminClient.from('workspace_events').insert({
      workspace_id: workspaceRow.id,
      event_type: 'enterprise_inquiry',
      details: {
        user_id: user.id,
        user_email: user.email,
        company: body.company,
        volume: VOLUME_LABELS[body.volume] ?? body.volume,
        countries: body.countries ?? null,
        phone_system: body.phone_system ?? null,
        message: body.message ?? null,
      },
    });
  }

  // Send email via Resend if configured
  const resendKey = process.env['RESEND_API_KEY'];
  const adminEmail = process.env['ADMIN_EMAIL'] ?? 'admin@voiceos.app';
  if (resendKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'VoiceOS <noreply@voiceos.app>',
        to: [adminEmail],
        subject: `Enterprise Inquiry — ${body.company}`,
        html: `
          <h2>New Enterprise Inquiry</h2>
          <p><strong>Company:</strong> ${body.company}</p>
          <p><strong>User:</strong> ${user.email}</p>
          <p><strong>Monthly Volume:</strong> ${VOLUME_LABELS[body.volume] ?? body.volume}</p>
          ${body.countries ? `<p><strong>Countries:</strong> ${body.countries}</p>` : ''}
          ${body.phone_system ? `<p><strong>Current Phone System:</strong> ${body.phone_system}</p>` : ''}
          ${body.message ? `<p><strong>Message:</strong><br>${body.message.replace(/\n/g, '<br>')}</p>` : ''}
        `,
      }),
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}
