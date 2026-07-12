import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */

  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3.tradingview.com',
      },
      {
        protocol: 'https',
        hostname: 'example.com',
      },
    ], // only if you use TradingView images.  The "images.domains" configuration is deprecated. Please use "images.remotePatterns" configuration instead.
  },
  allowedDevOrigins: ['galleria-primp-bolt.ngrok-free.dev'],
};

export default nextConfig;
