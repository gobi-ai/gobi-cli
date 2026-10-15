import type { NextConfig } from "next";

/** Vercel project root is this package. The MCP endpoint lives at `/mcp`. */
const nextConfig: NextConfig = {
  transpilePackages: [],
};

export default nextConfig;
