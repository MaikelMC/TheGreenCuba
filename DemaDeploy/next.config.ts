import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" }
    ]
  },
  webpack: (config) => {
    config.externals = config.externals || [];
    return config;
  }
};

export default nextConfig;