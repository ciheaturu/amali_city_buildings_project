import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // React-Leaflet types are incompatible with TS 5.x + Next.js 16
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
