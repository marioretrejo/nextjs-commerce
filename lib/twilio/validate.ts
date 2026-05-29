import { validateRequest } from 'twilio/lib/webhooks/webhooks';

/**
 * Validates that an incoming request is genuinely from Twilio.
 * Reads the raw body as URLSearchParams and compares against
 * the X-Twilio-Signature header using the webhook secret.
 */
export function validateTwilioRequest(
  req: Request,
  body: string,
  appUrl: string,
  path: string,
): boolean {
  const authToken = process.env['TWILIO_AUTH_TOKEN'];
  if (!authToken) return false;

  const signature = req.headers.get('x-twilio-signature') ?? '';
  const url = `${appUrl}${path}`;

  // Parse URLEncoded body into plain object for Twilio's validation
  const params: Record<string, string> = {};
  new URLSearchParams(body).forEach((v, k) => { params[k] = v; });

  return validateRequest(authToken, signature, url, params);
}
