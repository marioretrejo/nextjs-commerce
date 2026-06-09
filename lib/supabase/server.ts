import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

function assertEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`[SUPABASE_CONFIG] Missing required env var: ${name}`);
    throw new Error(`Missing required env var: ${name}`);
  }
  return val;
}

export async function createClient() {
  const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = assertEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: CookieOptions;
        }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from Server Component — cookies can't be set, ignored
        }
      },
    },
  });
}

export async function createServiceClient() {
  const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = assertEnv("SUPABASE_SERVICE_ROLE_KEY");
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: CookieOptions;
        }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // no-op in Server Component
        }
      },
    },
  });
}
