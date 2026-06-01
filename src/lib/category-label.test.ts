import { describe, expect, it } from 'vitest';
import { formatCategoryLabel } from '@/components/categories/CategoryLabel';

describe('formatCategoryLabel', () => {
  it('returns name only for Lucide keys', () => {
    expect(formatCategoryLabel('Comida', 'UTENSILS')).toBe('Comida');
  });

  it('keeps legacy emoji prefix for plain-text contexts', () => {
    expect(formatCategoryLabel('Comida', '🍽️')).toBe('🍽️ Comida');
  });
});
