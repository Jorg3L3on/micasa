import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas', 'pdfjs-dist'],
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
    proxyClientMaxBodySize: '4mb',
    // Enables React <ViewTransition> for Suspense reveals and shared-element morphs.
    viewTransition: true,
    // Next 16.1+ defaults this to true; Turbopack FS cache can grow large and add background work in dev.
    // When using `npm run dev:turbo`, set back to true if cold starts are too slow.
    turbopackFileSystemCacheForDev: false,
  },
  async redirects() {
    return [
      { source: '/account', destination: '/settings/account', permanent: true },
      {
        source: '/categories',
        destination: '/settings/categories',
        permanent: true,
      },
      {
        source: '/house-users',
        destination: '/settings/house-users',
        permanent: true,
      },
      {
        source: '/expense-templates',
        destination: '/settings/expense-templates',
        permanent: true,
      },
      {
        source: '/expense-templates/new',
        destination: '/settings/expense-templates/new',
        permanent: true,
      },
      {
        source: '/expense-templates/:id/edit',
        destination: '/settings/expense-templates/:id/edit',
        permanent: true,
      },
      {
        source: '/income-templates',
        destination: '/settings/income-templates',
        permanent: true,
      },
      {
        source: '/income-templates/new',
        destination: '/settings/income-templates/new',
        permanent: true,
      },
      {
        source: '/income-templates/:id/edit',
        destination: '/settings/income-templates/:id/edit',
        permanent: true,
      },
    ];
  },
};

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default withSentryConfig(nextConfig, {
  org: 'ziglabs',
  project: 'javascript-nextjs',
  authToken: sentryAuthToken,
  // Quiet when token is absent (local / CI without secrets).
  silent: !sentryAuthToken,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: false,
  },
});
