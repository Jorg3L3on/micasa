import type { MetadataRoute } from 'next';

/**
 * Public URLs only — never include /admin (support panel is noindexed).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || 'http://localhost:3000';
  return [
    {
      url: `${base}/`,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
