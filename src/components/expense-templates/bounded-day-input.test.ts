import { describe, expect, it } from 'vitest';
import { commitBoundedDay, sanitizeDayDigits } from './bounded-day-input';

describe('sanitizeDayDigits', () => {
  it('keeps only digits up to max length', () => {
    expect(sanitizeDayDigits('a1b2c3', 2)).toBe('12');
  });
});

describe('commitBoundedDay', () => {
  it('returns null for empty input', () => {
    expect(commitBoundedDay('', 1, 15)).toBeNull();
  });

  it('accepts values in range', () => {
    expect(commitBoundedDay('16', 16, 31)).toBe(16);
    expect(commitBoundedDay('5', 1, 15)).toBe(5);
  });

  it('rejects out-of-range committed values', () => {
    expect(commitBoundedDay('2', 16, 31)).toBeNull();
    expect(commitBoundedDay('20', 1, 15)).toBeNull();
  });
});
