import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force the dev server to listen on all interfaces, avoiding IPv4/IPv6
  // mismatch issues where Chrome connects to ::1 but the server only
  // binds to 127.0.0.1 (or vice-versa), which causes "page won't load".
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Tell browsers to close idle connections sooner,
          // preventing the CLOSE_WAIT buildup that blocks reconnection.
          { key: 'Connection', value: 'keep-alive' },
          { key: 'Keep-Alive', value: 'timeout=5' },
        ],
      },
    ];
  },
};

export default nextConfig;
