import { describe, expect, it } from 'vitest';
import { getAmountLengthTier, pickAmountSizeClass } from './amount-size';

describe('getAmountLengthTier', () => {
  it('keeps the full size up to five integer digits', () => {
    expect(getAmountLengthTier(0)).toBe(0);
    expect(getAmountLengthTier(12_345.67)).toBe(0);
  });

  it('steps down once for six digits or a negative five-digit amount', () => {
    expect(getAmountLengthTier(123_456.78)).toBe(1);
    expect(getAmountLengthTier(-12_345.67)).toBe(1);
    expect(getAmountLengthTier(-123_456.78)).toBe(1);
  });

  it('steps down twice for seven digits', () => {
    expect(getAmountLengthTier(1_234_567.89)).toBe(2);
    expect(getAmountLengthTier(-1_234_567.89)).toBe(2);
  });
});

describe('pickAmountSizeClass', () => {
  it('returns the class for the amount tier', () => {
    const sizes = ['text-2xl', 'text-xl', 'text-lg'] as const;
    expect(pickAmountSizeClass(500, sizes)).toBe('text-2xl');
    expect(pickAmountSizeClass(1_234_567.89, sizes)).toBe('text-lg');
  });
});
