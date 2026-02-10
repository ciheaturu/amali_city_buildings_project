import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Force Webpack instead of Turbopack
  experimental: {
    webpackBuildWorker: true,
  },

  // Disable Turbopack completely
  // This is the correct key for Next.js 16
  turbo: {
    rules: {},
  },
};

export default nextConfig;
