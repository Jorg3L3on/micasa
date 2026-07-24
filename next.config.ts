import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas', 'pdfjs-dist'],
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
    proxyClientMaxBodySize: '4mb',
    // Next 16.1+ defaults this to true; Turbopack FS cache can grow large and add background work in dev.
    // When using `npm run dev:turbo`, set back to true if cold starts are too slow.
    turbopackFileSystemCacheForDev: false,
  },
};

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN?.trim();

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: sentryAuthToken,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: true,
  // Upload source maps on deploy when auth token is present; skip locally.
  sourcemaps: {
    disable: !sentryAuthToken,
  },
});
