import { describe, expect, it } from 'vitest';
import {
  categoryIdsForRollup,
  isSelectableInPicker,
  rollupRootByCategoryId,
} from '@/lib/finance/category-hierarchy';

const rows = [
  { id: 1, parent_id: null, active: true },
  { id: 2, parent_id: 1, active: true },
  { id: 3, parent_id: 1, active: false },
  { id: 4, parent_id: null, active: false },
  { id: 5, parent_id: 4, active: true },
];

describe('categoryIdsForRollup', () => {
  it('includes parent and direct children', () => {
    expect(categoryIdsForRollup(1, rows).sort()).toEqual([1, 2, 3]);
  });

  it('returns only self for a leaf', () => {
    expect(categoryIdsForRollup(2, rows)).toEqual([2]);
  });
});

describe('rollupRootByCategoryId', () => {
  it('maps children to their parent root', () => {
    const map = rollupRootByCategoryId(rows);
    expect(map.get(1)).toBe(1);
    expect(map.get(2)).toBe(1);
    expect(map.get(3)).toBe(1);
    expect(map.get(5)).toBe(4);
  });
});

describe('isSelectableInPicker', () => {
  it('hides inactive categories', () => {
    expect(isSelectableInPicker(rows[2], rows)).toBe(false);
  });

  it('hides children of inactive parents', () => {
    expect(isSelectableInPicker(rows[4], rows)).toBe(false);
  });

  it('allows active roots and active children of active parents', () => {
    expect(isSelectableInPicker(rows[0], rows)).toBe(true);
    expect(isSelectableInPicker(rows[1], rows)).toBe(true);
  });
});
