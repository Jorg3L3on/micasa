import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CATEGORY_CATALOG,
  countDefaultCatalogCategories,
} from '@/lib/finance/default-category-catalog';
import { isCategoryIconKey } from '@/lib/category-icons';

describe('DEFAULT_CATEGORY_CATALOG', () => {
  it('has a frozen non-empty tree with valid Lucide keys', () => {
    expect(DEFAULT_CATEGORY_CATALOG.length).toBeGreaterThan(5);
    expect(countDefaultCatalogCategories()).toBeGreaterThan(
      DEFAULT_CATEGORY_CATALOG.length,
    );

    const names = new Set<string>();
    for (const root of DEFAULT_CATEGORY_CATALOG) {
      expect(isCategoryIconKey(root.icon)).toBe(true);
      expect(names.has(root.name)).toBe(false);
      names.add(root.name);
      for (const child of root.children) {
        expect(isCategoryIconKey(child.icon)).toBe(true);
        expect(names.has(child.name)).toBe(false);
        names.add(child.name);
      }
    }
  });

  it('includes subscription streaming children under Servicios y suscripciones', () => {
    const services = DEFAULT_CATEGORY_CATALOG.find(
      (r) => r.name === 'Servicios y suscripciones',
    );
    expect(services).toBeTruthy();
    const childNames = services!.children.map((c) => c.name);
    expect(childNames).toContain('Netflix');
    expect(childNames).toContain('Spotify');
    expect(childNames).toContain('Amazon Prime');
  });
});
