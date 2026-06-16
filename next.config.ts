import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  experimental: {
    proxyTimeout: 120_000, // 2 minutes — ingest involves LLM + embedding calls
  },
  async rewrites() {
    // In Docker the API container is reachable as `api:8000`, not localhost.
    // Set NEXT_PUBLIC_API_URL=http://api:8000 in docker-compose to override.
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry org/project are read from SENTRY_ORG and SENTRY_PROJECT env vars
  // during build. The DSN is read from NEXT_PUBLIC_SENTRY_DSN at runtime.
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  sourcemaps: {
    // Delete source maps after uploading to Sentry so they aren't served publicly.
    filesToDeleteAfterUpload: [".next/**/*.map"],
  },
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: true,
  },
});
