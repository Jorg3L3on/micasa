import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'],
  env: {
    // Versions the service worker URL so each deploy triggers the update prompt.
    NEXT_PUBLIC_APP_VERSION:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? 'dev',
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
    proxyClientMaxBodySize: '4mb',
    // Next 16.1+ defaults this to true; Turbopack FS cache can grow large and add background work in dev.
    turbopackFileSystemCacheForDev: false,
  },
  async headers() {
    const oauthFormActionCsp =
      "form-action 'self' https://chatgpt.com https://chat.openai.com";
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/oauth/consent',
        headers: [{ key: 'Content-Security-Policy', value: oauthFormActionCsp }],
      },
      {
        source: '/api/oauth/consent',
        headers: [{ key: 'Content-Security-Policy', value: oauthFormActionCsp }],
      },
    ];
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
      {
        source: '/budgets',
        destination: '/settings/budgets',
        permanent: true,
      },
      {
        source: '/budgets/:path*',
        destination: '/settings/budgets/:path*',
        permanent: true,
      },
      {
        source: '/expenses',
        destination: '/transactions',
        permanent: true,
      },
      {
        source: '/expenses/:path*',
        destination: '/transactions',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
