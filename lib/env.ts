import { z } from "zod";

// Common weak values that must never be used as secrets in production
const WEAK_SECRETS = new Set([
  "secret",
  "changeme",
  "test",
  "password",
  "internal",
  "development",
  "12345",
  "admin",
]);

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_PRICE_PRO: z.string().min(1),
  STRIPE_PRICE_SCALE: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  // Optional in schema so non-production builds don't fail at parse time.
  // Production enforcement is done explicitly below.
  INTERNAL_API_SECRET: z
    .string()
    .min(16, "INTERNAL_API_SECRET must be at least 16 characters")
    .refine(
      (val) => !WEAK_SECRETS.has(val.toLowerCase()),
      "INTERNAL_API_SECRET must not be a common weak value (secret, changeme, test…)",
    )
    .optional(),
  // Dedicated secret for signing outbound call.completed webhook payloads.
  // Separate from INTERNAL_API_SECRET so webhook signing keys can be rotated
  // independently of internal API auth. Optional — if absent, webhooks are
  // sent unsigned (X-VoiceOS-Signature: unsigned) and a warning is logged.
  // Generate: openssl rand -hex 32
  VOICEOS_WEBHOOK_SIGNING_SECRET: z
    .string()
    .min(16, "VOICEOS_WEBHOOK_SIGNING_SECRET must be at least 16 characters")
    .refine(
      (val) => !WEAK_SECRETS.has(val.toLowerCase()),
      "VOICEOS_WEBHOOK_SIGNING_SECRET must not be a common weak value",
    )
    .optional(),
});

// Validated at module load time — fails with a clear error during build/startup if any var is missing
export const env = envSchema.parse(process.env);

// In production, INTERNAL_API_SECRET is mandatory.
// Fail fast at startup rather than silently opening internal endpoints.
if (process.env["NODE_ENV"] === "production" && !env.INTERNAL_API_SECRET) {
  throw new Error(
    "[env] INTERNAL_API_SECRET is required in production.\n" +
      "Generate one with: openssl rand -hex 32\n" +
      "Then add it to your Vercel / Render environment variables.",
  );
}
