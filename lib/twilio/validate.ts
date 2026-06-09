import { validateRequest } from "twilio/lib/webhooks/webhooks";

/**
 * Validates that an incoming request is genuinely from Twilio by comparing
 * the X-Twilio-Signature header against a locally-computed HMAC-SHA1.
 *
 * Returns false (reject) when:
 *   - TWILIO_AUTH_TOKEN is not configured
 *   - X-Twilio-Signature header is missing
 *   - Signature does not match
 */
export function validateTwilioRequest(
  req: Request,
  body: string,
  appUrl: string,
  path: string,
): boolean {
  const authToken = process.env["TWILIO_AUTH_TOKEN"];
  if (!authToken) {
    console.error("[twilio.validate] TWILIO_AUTH_TOKEN not set — rejecting");
    return false;
  }

  const signature = req.headers.get("x-twilio-signature") ?? "";
  if (!signature) {
    console.warn("[twilio.validate] Missing X-Twilio-Signature header");
    return false;
  }

  // Use the public URL for HMAC computation — must match what Twilio signed
  const url = `${appUrl}${path}`;

  // Parse URL-encoded body into a plain object for Twilio's validation helper
  const params: Record<string, string> = {};
  new URLSearchParams(body).forEach((v, k) => {
    params[k] = v;
  });

  const valid = validateRequest(authToken, signature, url, params);
  if (!valid) {
    console.warn("[twilio.validate] Invalid signature for URL:", url);
  }
  return valid;
}

/**
 * Returns true when Twilio webhook validation MUST be enforced.
 *
 * Rules:
 *   - Production: always validate, no exceptions.
 *   - Non-production: skip only when TWILIO_WEBHOOK_VALIDATION_DISABLED=true.
 *
 * This prevents the common mistake of relying on NODE_ENV which can be set
 * incorrectly on some hosting platforms.
 */
export function shouldValidateTwilio(): boolean {
  // Absolute rule: production is always enforced.
  if (process.env["NODE_ENV"] === "production") return true;
  // Non-prod: explicit opt-out only.
  return process.env["TWILIO_WEBHOOK_VALIDATION_DISABLED"] !== "true";
}
