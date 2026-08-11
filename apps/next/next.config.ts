import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  turbopack: {
    // The Next package is hoisted in the monorepo root by npm workspaces.
    // Turbopack must therefore allow resolution from that root as well.
    root: path.resolve(__dirname, "../..")
  }
};

export default nextConfig;
