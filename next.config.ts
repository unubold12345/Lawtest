import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      ...["browse", "quiz", "v2", "history", "calendar"].map((route) => ({
        source: `/${route}/:path*`, destination: `/exams/lawyer/2026/${route}/:path*`, permanent: true,
      })),
      { source: "/study", destination: "/exams/lawyer/2026/v2", permanent: true },
      { source: "/plan", destination: "/plans/lawyer-2026-full", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
