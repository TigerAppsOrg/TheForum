// Validate env vars at build time — throws if required vars are missing.
import "./src/env.ts";

import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for EC2 deploys (deploy/build-release.sh).
  output: "standalone",
  // Monorepo: trace workspace packages from the repo root.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  // Allow Next.js to transpile the workspace database package (TypeScript sources)
  transpilePackages: ["@the-forum/database"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.figma.com",
        pathname: "/api/mcp/asset/**",
      },
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
