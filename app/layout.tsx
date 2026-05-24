import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'VoiceOS — AI Voice Agent Platform',
    template: '%s | VoiceOS'
  },
  description: 'The AI Voice Agent Platform That Closes Deals While You Sleep.',
  metadataBase: new URL(process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000')
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="bg-white text-[#0a0a0a] antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#0a0a0a',
              color: '#ffffff',
              border: '1px solid #262626'
            }
          }}
        />
      </body>
    </html>
  );
}
