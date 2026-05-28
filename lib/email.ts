import { Resend } from 'resend';

function getResend(): Resend | null {
  const key = process.env['RESEND_API_KEY'];
  if (!key) return null;
  return new Resend(key);
}

const FROM = 'VoiceOS <noreply@voiceos.app>';

export async function sendTeamInvite({
  to,
  inviterName,
  workspaceName,
  inviteToken,
  appUrl
}: {
  to: string;
  inviterName: string;
  workspaceName: string;
  inviteToken: string;
  appUrl: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const acceptUrl = `${appUrl}/invite/${inviteToken}`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `${inviterName} invited you to ${workspaceName} on VoiceOS`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;color:#0a0a0a">
        <h2 style="margin:0 0 8px">You've been invited</h2>
        <p style="color:#6b6b6b;margin:0 0 24px">
          <strong>${inviterName}</strong> invited you to join the
          <strong>${workspaceName}</strong> workspace on VoiceOS.
        </p>
        <a href="${acceptUrl}"
           style="display:inline-block;background:#0a0a0a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500">
          Accept invitation
        </a>
        <p style="color:#6b6b6b;font-size:12px;margin-top:24px">
          If you didn't expect this invitation, you can ignore this email.
        </p>
      </div>
    `
  });
}

export async function sendPaymentFailed({
  to,
  workspaceName,
  amount,
  retryUrl
}: {
  to: string;
  workspaceName: string;
  amount: string;
  retryUrl: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Payment failed for ${workspaceName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;color:#0a0a0a">
        <h2 style="margin:0 0 8px">Payment failed</h2>
        <p style="color:#6b6b6b;margin:0 0 24px">
          We couldn't process your payment of <strong>${amount}</strong> for
          <strong>${workspaceName}</strong>. Please update your payment method to
          keep your account active.
        </p>
        <a href="${retryUrl}"
           style="display:inline-block;background:#0a0a0a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500">
          Update payment method
        </a>
      </div>
    `
  });
}

export async function sendWelcomeEmail({
  to,
  name,
  workspaceName,
}: {
  to: string;
  name: string;
  workspaceName: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://voiceos.app';

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Welcome to VoiceOS, ${name}!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;color:#0a0a0a">
        <h2 style="margin:0 0 8px">Welcome aboard, ${name}!</h2>
        <p style="color:#6b6b6b;margin:0 0 16px">
          Your workspace <strong>${workspaceName}</strong> is ready. You can now build and deploy AI voice agents.
        </p>
        <p style="color:#6b6b6b;margin:0 0 24px">
          Get started by creating your first agent or uploading a contact list to launch a campaign.
        </p>
        <a href="${appUrl}/dashboard"
           style="display:inline-block;background:#0a0a0a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500">
          Go to Dashboard
        </a>
        <p style="color:#6b6b6b;font-size:12px;margin-top:24px">
          Questions? Reply to this email and we'll help you get set up.
        </p>
      </div>
    `,
  });
}

export async function sendQuotaWarning({
  to,
  workspaceName,
  pct,
  minutesLeft,
}: {
  to: string;
  workspaceName: string;
  pct: number;
  minutesLeft: number;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://voiceos.app';
  const isExhausted = minutesLeft <= 0;
  const subject = isExhausted
    ? `Minute quota exhausted — ${workspaceName}`
    : `${pct}% of minute quota used — ${workspaceName}`;

  await resend.emails.send({
    from: FROM,
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;color:#0a0a0a">
        <h2 style="margin:0 0 8px">${isExhausted ? 'Quota exhausted' : `${pct}% quota used`}</h2>
        <p style="color:#6b6b6b;margin:0 0 16px">
          ${isExhausted
            ? `Your workspace <strong>${workspaceName}</strong> has used all its contracted minutes. Active campaigns have been paused.`
            : `Your workspace <strong>${workspaceName}</strong> has used <strong>${pct}%</strong> of its minute quota. <strong>${minutesLeft.toLocaleString()} minutes</strong> remaining.`
          }
        </p>
        <a href="${appUrl}/billing"
           style="display:inline-block;background:#0a0a0a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500">
          ${isExhausted ? 'Contact support' : 'View billing'}
        </a>
      </div>
    `,
  });
}

export async function sendTopUpReceipt({
  to,
  workspaceName,
  amount,
}: {
  to: string;
  workspaceName: string;
  amount: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://voiceos.app';

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Credit added — ${amount} to ${workspaceName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;color:#0a0a0a">
        <h2 style="margin:0 0 8px">Credit added</h2>
        <p style="color:#6b6b6b;margin:0 0 8px">
          <strong>${amount}</strong> has been added to <strong>${workspaceName}</strong>. Your credit never expires.
        </p>
        <p style="color:#6b6b6b;margin:0 0 24px">You're all set to start making calls.</p>
        <a href="${appUrl}/dashboard"
           style="display:inline-block;background:#0a0a0a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500">
          Go to Dashboard
        </a>
      </div>
    `,
  });
}

export async function sendCampaignComplete({
  to,
  campaignName,
  totalCalls,
  converted
}: {
  to: string;
  campaignName: string;
  totalCalls: number;
  converted: number;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const rate = totalCalls > 0 ? Math.round((converted / totalCalls) * 100) : 0;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Campaign "${campaignName}" completed`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;color:#0a0a0a">
        <h2 style="margin:0 0 8px">Campaign complete</h2>
        <p style="color:#6b6b6b;margin:0 0 16px">
          Your campaign <strong>${campaignName}</strong> has finished.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e0e0e0;color:#6b6b6b">Total calls</td>
            <td style="padding:8px 0;border-bottom:1px solid #e0e0e0;font-weight:500;text-align:right">${totalCalls}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e0e0e0;color:#6b6b6b">Converted</td>
            <td style="padding:8px 0;border-bottom:1px solid #e0e0e0;font-weight:500;text-align:right">${converted}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b6b6b">Conversion rate</td>
            <td style="padding:8px 0;font-weight:500;text-align:right">${rate}%</td>
          </tr>
        </table>
      </div>
    `
  });
}
