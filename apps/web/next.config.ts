import type { NextConfig } from 'next';
import { parseWebEnv } from '@ekms/config';

const { API_INTERNAL_URL } = parseWebEnv({
  ...process.env,
  API_INTERNAL_URL: process.env.API_INTERNAL_URL ?? 'http://localhost:3001',
});

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${API_INTERNAL_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
