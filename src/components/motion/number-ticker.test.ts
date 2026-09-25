import { describe, expect, it } from 'vitest';
import { formatNumberTickerText } from '@/components/motion/number-ticker';
import { formatCurrency } from '@/lib/utils';

describe('formatNumberTickerText', () => {
  it('keeps currency cents instead of rounding to a whole peso', () => {
    expect(
      formatNumberTickerText(1234.5, { format: formatCurrency }),
    ).toBe(formatCurrency(1234.5));
    expect(formatNumberTickerText(1234.5, { format: formatCurrency })).toBe(
      '$1,234.50',
    );
    expect(formatNumberTickerText(-10, { format: formatCurrency })).toBe(
      '-$10.00',
    );
  });
});
