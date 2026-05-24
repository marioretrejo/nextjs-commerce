import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json() as Record<string, unknown>;
  console.log('ElevenLabs webhook:', body);
  return NextResponse.json({ received: true });
}
