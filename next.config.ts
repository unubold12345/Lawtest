import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin uses Node.js APIs that break when bundled into
  // serverless functions — keep it external (loaded via require at runtime).
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
