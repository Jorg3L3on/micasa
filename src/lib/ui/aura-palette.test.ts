import { describe, expect, it } from 'vitest';
import { getDueRowTone } from './aura-palette';

describe('getDueRowTone', () => {
  it('maps settled states regardless of days left', () => {
    expect(getDueRowTone('paid', -3)).toBe('emerald');
    expect(getDueRowTone('overdue', 10)).toBe('destructive');
    expect(getDueRowTone('missing', 20)).toBe('amber');
    expect(getDueRowTone('muted', 2)).toBeNull();
  });

  it('colors pending rows by how soon they are due', () => {
    expect(getDueRowTone('pending', -1)).toBe('destructive');
    expect(getDueRowTone('pending', 0)).toBe('amber');
    expect(getDueRowTone('pending', 7)).toBe('amber');
    expect(getDueRowTone('pending', 8)).toBe('blue');
    expect(getDueRowTone('pending', null)).toBe('blue');
  });
});
