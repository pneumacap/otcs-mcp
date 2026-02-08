import type { NextConfig } from "next";
import path from "path";

const coreRoot = path.resolve(__dirname, "../packages/core/src");

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  transpilePackages: ['@otcs/core'],
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@otcs/core/client": `${coreRoot}/client/otcs-client.ts`,
      "@otcs/core/tools/formats": `${coreRoot}/tools/formats.ts`,
      "@otcs/core/tools/handler": `${coreRoot}/tools/handler.ts`,
      "@otcs/core/tools/utils": `${coreRoot}/tools/utils.ts`,
      "@otcs/core": `${coreRoot}/index.ts`,
    };
    return config;
  },
};

export default nextConfig;
