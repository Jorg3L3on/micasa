import { describe, expect, it } from 'vitest';
import { splitRollingChars } from './rolling-number';

describe('splitRollingChars', () => {
  it('turns digits into rolling columns and keeps symbols fixed', () => {
    const columns = splitRollingChars('$1,204.50');
    expect(columns.map((c) => (c.kind === 'digit' ? c.digit : c.char))).toEqual([
      '$', 1, ',', 2, 0, 4, '.', 5, 0,
    ]);
  });

  it('keys columns by place value from the right', () => {
    const short = splitRollingChars('$99.00');
    const long = splitRollingChars('$1,099.00');
    const keyFor = (cols: ReturnType<typeof splitRollingChars>, fromRight: number) =>
      cols[cols.length - 1 - fromRight].key;
    // units, tens, hundredths, tenths keep the same keys when the number grows
    for (const place of [0, 1, 3, 4]) {
      expect(keyFor(short, place)).toBe(keyFor(long, place));
    }
  });
});
