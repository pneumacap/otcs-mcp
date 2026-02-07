import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {},
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@otcs/core/client": path.resolve(__dirname, "../packages/core/src/client/otcs-client.ts"),
      "@otcs/core/tools/formats": path.resolve(__dirname, "../packages/core/src/tools/formats.ts"),
      "@otcs/core/tools/handler": path.resolve(__dirname, "../packages/core/src/tools/handler.ts"),
      "@otcs/core/tools/utils": path.resolve(__dirname, "../packages/core/src/tools/utils.ts"),
      "@otcs/core": path.resolve(__dirname, "../packages/core/src/index.ts"),
    };
    // Resolve .js imports to .ts files (the MCP source uses ESM .js extensions)
    config.resolve.extensionAlias = {
      ".js": [".ts", ".js"],
    };
    return config;
  },
};

export default nextConfig;
