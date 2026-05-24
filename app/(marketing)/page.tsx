import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'VoiceOS — AI Voice Agents at Scale' };

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      <h1 className="text-5xl font-bold tracking-tight text-black">VoiceOS</h1>
      <p className="mt-4 text-lg text-neutral-500 max-w-md text-center">
        AI Voice Agents — deployed, managed, and optimised in one platform.
      </p>
    </main>
  );
}
