import type { NextConfig } from 'next';

const config: NextConfig = {
  experimental: {
    ppr: false
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**'
      }
    ]
  }
};

export default config;
