import { describe, expect, it } from 'vitest';

import manifest from './manifest';

describe('web app manifest', () => {
  const webManifest = manifest();

  it('is a standalone MiCasa PWA in es-MX', () => {
    expect(webManifest.name).toBe('MiCasa');
    expect(webManifest.short_name).toBe('MiCasa');
    expect(webManifest.display).toBe('standalone');
    expect(webManifest.start_url).toBe('/');
    expect(webManifest.lang).toBe('es-MX');
    expect(webManifest.categories).toEqual(['finance']);
  });

  it('uses Orion navy for splash and theme', () => {
    expect(webManifest.theme_color).toBe('#060914');
    expect(webManifest.background_color).toBe('#060914');
  });

  it('ships PNG icons at 180, 192, and 512', () => {
    const sizes = (webManifest.icons ?? []).map((icon) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['180x180', '192x192', '512x512']));
    expect(webManifest.icons?.every((icon) => icon.type === 'image/png')).toBe(true);
  });
});
