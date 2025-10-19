import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_NAKAMA_HOST: process.env.NEXT_PUBLIC_NAKAMA_HOST,
    NEXT_PUBLIC_NAKAMA_PORT: process.env.NEXT_PUBLIC_NAKAMA_PORT,
    NEXT_PUBLIC_NAKAMA_SERVER_KEY: process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY,
    NEXT_PUBLIC_NAKAMA_USE_SSL: process.env.NEXT_PUBLIC_NAKAMA_USE_SSL,
  }
};

export default nextConfig;
