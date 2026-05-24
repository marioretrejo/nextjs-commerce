import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'VoiceOS', template: '%s · VoiceOS' },
  description: 'AI Voice Agents — deployed, managed, and optimised in one platform.',
  metadataBase: new URL('https://voiceos.ai')
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="bg-white text-black antialiased selection:bg-black selection:text-white">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: 'border border-black bg-white text-black rounded-none shadow-none',
              description: 'text-neutral-600',
              actionButton: 'bg-black text-white rounded-none',
              cancelButton: 'bg-white text-black border border-black rounded-none'
            }
          }}
        />
      </body>
    </html>
  );
}
