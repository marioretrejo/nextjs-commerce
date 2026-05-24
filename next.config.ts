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
  },
  webpack(webpackConfig) {
    // retell-client-js-sdk is an optional browser SDK loaded dynamically at runtime
    webpackConfig.resolve = webpackConfig.resolve ?? {};
    webpackConfig.resolve.fallback = {
      ...(webpackConfig.resolve.fallback ?? {}),
      'retell-client-js-sdk': false
    };
    return webpackConfig;
  }
};

export default config;
