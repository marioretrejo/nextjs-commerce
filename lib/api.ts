import { NextResponse } from 'next/server';
import { z, type ZodSchema } from 'zod';

type RouteHandler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

/**
 * Wraps a Next.js App Router handler so that any unhandled exception always
 * returns a JSON error instead of an HTML 500/504 page.  Use on routes that
 * do not already have a top-level try-catch.
 *
 * Usage: export const GET = withHandler(async (req) => { ... });
 */
export function withHandler(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      console.error('[api] Unhandled error:', err);
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

export function apiOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function parseBody<T>(schema: ZodSchema<T>, data: unknown):
  | { success: true; data: T }
  | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    return { success: false, response: apiError(message, 400) };
  }
  return { success: true, data: result.data };
}
