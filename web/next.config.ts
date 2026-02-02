import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {},
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@otcs/client": path.resolve(__dirname, "../src/client/otcs-client.ts"),
      "@otcs/types": path.resolve(__dirname, "../src/types.ts"),
    };
    // Resolve .js imports to .ts files (the MCP source uses ESM .js extensions)
    config.resolve.extensionAlias = {
      ".js": [".ts", ".js"],
    };
    return config;
  },
};

export default nextConfig;
