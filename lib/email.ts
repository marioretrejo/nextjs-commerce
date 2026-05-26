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
