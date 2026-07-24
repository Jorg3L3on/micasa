import type { MetadataRoute } from 'next';

/**
 * Keep /admin out of crawlers. Public landing pages can be added later
 * without opening the support panel.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/'],
      },
    ],
  };
}
