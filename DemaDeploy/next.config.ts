import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.56.1"],
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