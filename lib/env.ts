import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_PRICE_PRO: z.string().min(1),
  STRIPE_PRICE_SCALE: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
});

// Validated at module load time — fails with a clear error during build/startup if any var is missing
export const env = envSchema.parse(process.env);
